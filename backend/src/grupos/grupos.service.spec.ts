import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HorariosService } from '../horarios/horarios.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { GruposService } from './grupos.service';
import {
  inscribirAlumnosDelGrupo,
  quitarInscripcionesDelGrupo,
} from '../common/inscripciones-grupo';

jest.mock('../common/inscripciones-grupo', () => ({
  inscribirAlumnosDelGrupo: jest
    .fn()
    .mockResolvedValue({ creadas: 0, reactivadas: 0 }),
  quitarInscripcionesDelGrupo: jest.fn().mockResolvedValue(0),
}));

describe('GruposService', () => {
  const grupoFindUnique = jest.fn();
  const grupoFindFirst = jest.fn();
  const grupoUpdate = jest.fn();
  const usuarioFindFirst = jest.fn();
  const usuarioFindUnique = jest.fn();
  const usuarioUpdate = jest.fn();
  const usuarioCreate = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    grupo: {
      findUnique: grupoFindUnique,
      findFirst: grupoFindFirst,
      update: grupoUpdate,
    },
    usuario: {
      findFirst: usuarioFindFirst,
      findUnique: usuarioFindUnique,
      update: usuarioUpdate,
      create: usuarioCreate,
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const horarios = {} as unknown as HorariosService;
  const usuarios = {} as unknown as UsuariosService;
  const service = new GruposService(prisma, horarios, usuarios);

  beforeEach(() => {
    jest.clearAllMocks();
    grupoFindUnique.mockResolvedValue({ id: 4, nombre: 'ISC-1A' });
    grupoFindFirst.mockResolvedValue(null);
  });

  const grupoExistente = {
    id: 4,
    nombre: '103A',
    semestre: 1,
    seccion: 'A',
    carreraId: 1,
    periodo: '2026-A',
    carrera: { id: 1, nombre: 'ISC', codigo: '06' },
  };

  it('renombra el grupo con el nombre que escribe el administrador', async () => {
    grupoFindUnique.mockResolvedValue(grupoExistente);
    grupoUpdate.mockResolvedValue({ id: 4, nombre: 'ISC-1A' });

    await service.editarGrupo(4, { nombre: '  isc-1a  ' });

    expect(grupoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: { nombre: 'ISC-1A' },
      }),
    );
  });

  it('rechaza un nombre que ya usa otro grupo del mismo periodo', async () => {
    grupoFindUnique.mockResolvedValue(grupoExistente);
    grupoFindFirst.mockResolvedValue({ id: 9, nombre: 'ISC-1A' });

    await expect(
      service.editarGrupo(4, { nombre: 'ISC-1A' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(grupoUpdate).not.toHaveBeenCalled();
  });

  it('borra el grupo con su horario y libera todo lo demás', async () => {
    const contador = (count: number) => jest.fn().mockResolvedValue({ count });
    const tx = {
      usuario: { updateMany: contador(12) },
      horarioMateria: { deleteMany: contador(7) },
      claseSesion: { updateMany: contador(30) },
      tarea: { updateMany: contador(5) },
      calificacionUnidad: { updateMany: contador(60) },
      importacionHorario: { updateMany: contador(2) },
      grupo: {
        delete: jest.fn().mockResolvedValue({ id: 4, nombre: 'ISC-1A' }),
      },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.eliminarGrupoDefinitivo(4)).resolves.toEqual({
      id: 4,
      nombre: 'ISC-1A',
      horariosEliminados: 7,
      liberados: {
        alumnos: 12,
        sesiones: 30,
        tareas: 5,
        calificaciones: 60,
        importaciones: 2,
      },
    });
    expect(tx.usuario.updateMany).toHaveBeenCalledWith({
      where: { grupoId: 4 },
      data: { grupoId: null },
    });
    expect(tx.horarioMateria.deleteMany).toHaveBeenCalledWith({
      where: { grupoId: 4 },
    });
    // Las calificaciones no se borran: sólo dejan de apuntar al grupo.
    expect(tx.calificacionUnidad.updateMany).toHaveBeenCalledWith({
      where: { grupoId: 4 },
      data: { grupoId: null },
    });
    expect(tx.grupo.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  // ─── Mis grupos (docente) ─────────────────────────────────────────────────

  const grupoDelDocente = { id: 4, nombre: '106A', carreraId: 1, semestre: 1 };

  it('importa la lista al grupo: vincula, crea y reporta a quien ya tiene grupo', async () => {
    grupoFindFirst.mockResolvedValue(grupoDelDocente);
    usuarioFindFirst
      .mockResolvedValueOnce({
        id: 11,
        rol: 'ALUMNO',
        grupoId: null,
        carreraId: 1,
        grupo: null,
      })
      .mockResolvedValueOnce({
        id: 12,
        rol: 'ALUMNO',
        grupoId: 9,
        carreraId: 1,
        grupo: { nombre: '806A' },
      });
    usuarioCreate.mockResolvedValue({ id: 13 });

    const resultado = await service.importarAlumnosAMiGrupo(4, 37, {
      alumnos: [
        { nombre: ' Ana López ', numeroControl: '225q0103' },
        { nombre: 'Beto Ruiz', numeroControl: '225Q0104' },
        { nombre: 'Carla Díaz' },
      ],
    });

    expect(resultado).toEqual({
      creados: 1,
      vinculados: 1,
      yaEnGrupo: 0,
      errores: [{ nombre: 'Beto Ruiz', motivo: 'Ya está en el grupo 806A' }],
    });
    expect(usuarioUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { grupoId: 4 },
    });
    // El alumno nuevo hereda carrera y semestre del grupo.
    expect(usuarioCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Carla Díaz',
          carreraId: 1,
          semestre: 1,
          grupoId: 4,
        }),
      }),
    );
    // Quien entra al grupo queda inscrito en sus materias; el rechazado no.
    expect(inscribirAlumnosDelGrupo).toHaveBeenCalledWith(prisma, 4, {
      alumnoIds: [11, 13],
    });
  });

  it('al quitar a un alumno del grupo también lo saca de sus clases', async () => {
    grupoFindFirst.mockResolvedValue(grupoDelDocente);
    usuarioFindUnique.mockResolvedValue({ id: 11, grupoId: 4 });

    await expect(service.quitarAlumnoDeMiGrupo(4, 37, 11)).resolves.toEqual({
      ok: true,
    });
    expect(usuarioUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { grupoId: null },
    });
    expect(quitarInscripcionesDelGrupo).toHaveBeenCalledWith(prisma, 4, [11]);
  });

  it('no deja tocar un grupo que no es del docente', async () => {
    grupoFindFirst.mockResolvedValue(null);

    await expect(
      service.agregarAlumnosAMiGrupo(4, 37, [11]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no elimina un grupo inexistente', async () => {
    grupoFindUnique.mockResolvedValue(null);

    await expect(service.eliminarGrupoDefinitivo(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
