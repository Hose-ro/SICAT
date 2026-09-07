import { ForbiddenException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { InscripcionesService } from './inscripciones.service';

describe('InscripcionesService', () => {
  const materiaCount = jest.fn();
  const materiaFindUnique = jest.fn();
  const horarioCount = jest.fn();
  const usuarioFindMany = jest.fn();
  const grupoFindUnique = jest.fn();
  const inscripcionFindUnique = jest.fn();
  const inscripcionCreate = jest.fn();
  const inscripcionUpdate = jest.fn();

  const prisma = {
    materia: { count: materiaCount, findUnique: materiaFindUnique },
    horarioMateria: { count: horarioCount },
    usuario: { findMany: usuarioFindMany },
    grupo: { findUnique: grupoFindUnique },
    inscripcion: {
      findUnique: inscripcionFindUnique,
      create: inscripcionCreate,
      update: inscripcionUpdate,
    },
  } as unknown as PrismaService;

  const crearNotificacion = jest.fn();
  const notificaciones = {
    crear: crearNotificacion,
  } as unknown as NotificacionesService;
  const crearUsuario = jest.fn();
  const usuarios = { create: crearUsuario } as unknown as UsuariosService;

  const service = new InscripcionesService(prisma, notificaciones, usuarios);
  const docente = { id: 7, rol: 'DOCENTE' };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaCount.mockResolvedValue(1);
    horarioCount.mockResolvedValue(1);
    materiaFindUnique.mockResolvedValue({
      id: 4,
      nombre: 'Redes',
      carreraId: 2,
      semestre: 5,
    });
    usuarioFindMany.mockResolvedValue([{ id: 20, nombre: 'Ana López' }]);
    inscripcionFindUnique.mockResolvedValue(null);
    inscripcionCreate.mockResolvedValue({ id: 1 });
    inscripcionUpdate.mockResolvedValue({ id: 1 });
    grupoFindUnique.mockResolvedValue({ id: 3, carreraId: 2, semestre: 5 });
    crearUsuario.mockResolvedValue({ id: 21, nombre: 'Luis Díaz' });
  });

  it('inscribe al alumno en la materia dejando constancia del grupo', async () => {
    const resultado = await service.inscribirAlumnos(
      4,
      { alumnoIds: [20], grupoId: 3 },
      docente,
    );

    expect(inscripcionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alumnoId: 20,
        materiaId: 4,
        estado: 'ACEPTADA',
        grupoId: 3,
      }) as Record<string, unknown>,
    });
    expect(resultado).toEqual({
      inscritos: 1,
      reactivados: 0,
      yaInscritos: 0,
    });
    expect(crearNotificacion).toHaveBeenCalled();
  });

  it('reactiva una inscripción rechazada en vez de duplicarla', async () => {
    inscripcionFindUnique.mockResolvedValue({ id: 9, estado: 'RECHAZADA' });

    const resultado = await service.inscribirAlumnos(
      4,
      { alumnoIds: [20] },
      docente,
    );

    expect(inscripcionUpdate).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { estado: 'ACEPTADA', grupoId: null },
    });
    expect(resultado.reactivados).toBe(1);
  });

  it('no repite el alta de quien ya estaba inscrito', async () => {
    inscripcionFindUnique.mockResolvedValue({ id: 9, estado: 'ACEPTADA' });

    const resultado = await service.inscribirAlumnos(
      4,
      { alumnoIds: [20] },
      docente,
    );

    expect(inscripcionCreate).not.toHaveBeenCalled();
    expect(inscripcionUpdate).not.toHaveBeenCalled();
    expect(resultado.yaInscritos).toBe(1);
  });

  it('rechaza al docente que no imparte la materia', async () => {
    // La materia existe, pero no es suya ni por asignación ni por horario.
    materiaCount.mockResolvedValueOnce(1).mockResolvedValue(0);
    horarioCount.mockResolvedValue(0);

    await expect(
      service.inscribirAlumnos(4, { alumnoIds: [20] }, docente),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inscripcionCreate).not.toHaveBeenCalled();
  });

  it('crea la cuenta del alumno heredando carrera y semestre de la clase', async () => {
    usuarioFindMany.mockResolvedValue([{ id: 21, nombre: 'Luis Díaz' }]);

    await service.crearAlumnoEInscribir(
      4,
      {
        nombre: 'Luis Díaz',
        numeroControl: '225Q0104',
        password: 'temporal123',
        grupoId: 3,
      },
      docente,
    );

    expect(crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Luis Díaz',
        numeroControl: '225Q0104',
        rol: Rol.ALUMNO,
        carreraId: 2,
        semestre: 5,
      }),
    );
    expect(inscripcionCreate).toHaveBeenCalled();
  });
});
