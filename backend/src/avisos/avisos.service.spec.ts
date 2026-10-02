import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AvisosService } from './avisos.service';

describe('AvisosService', () => {
  const materiaCount = jest.fn();
  const materiaFindFirst = jest.fn();
  const horarioMateriaCount = jest.fn();
  const horarioMateriaFindMany = jest.fn();
  const inscripcionFindMany = jest.fn();
  const usuarioFindUnique = jest.fn();
  const avisoCreate = jest.fn();
  const avisoFindFirst = jest.fn();
  const avisoFindUnique = jest.fn();
  const avisoFindMany = jest.fn();
  const avisoUpdate = jest.fn();
  const avisoDeleteMany = jest.fn();
  const crearParaVarios = jest.fn();
  const prisma = {
    materia: { count: materiaCount, findFirst: materiaFindFirst },
    horarioMateria: {
      count: horarioMateriaCount,
      findMany: horarioMateriaFindMany,
    },
    inscripcion: { findMany: inscripcionFindMany },
    usuario: { findUnique: usuarioFindUnique },
    aviso: {
      create: avisoCreate,
      findFirst: avisoFindFirst,
      findUnique: avisoFindUnique,
      findMany: avisoFindMany,
      update: avisoUpdate,
      deleteMany: avisoDeleteMany,
    },
  } as unknown as PrismaService;
  const service = new AvisosService(prisma, {
    crearParaVarios,
  } as unknown as NotificacionesService);
  const docente = { id: 31, rol: 'DOCENTE' };
  const roster = [
    { alumno: { id: 500, nombre: 'Ana' } },
    { alumno: { id: 501, nombre: 'Beto' } },
  ];
  const notificacion = () =>
    (crearParaVarios.mock.calls[0] as [number[], { titulo: string }])[1];

  beforeEach(() => {
    jest.clearAllMocks();
    // asegurarAccesoMateria: la materia existe y el docente tiene horario en el grupo.
    materiaCount.mockImplementation(
      ({ where }: { where: { docenteId?: number } }) =>
        Promise.resolve('docenteId' in where ? 0 : 1),
    );
    horarioMateriaCount.mockResolvedValue(1);
    materiaFindFirst.mockResolvedValue({ id: 12, nombre: 'Redes' });
    inscripcionFindMany.mockResolvedValue(roster);
    avisoCreate.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 7, ...data }),
    );
  });

  it('publica al grupo y notifica a todo el padrón', async () => {
    const aviso = await service.crear(docente, {
      materiaId: 12,
      grupoId: 3,
      titulo: ' Traigan calculadora ',
      cuerpo: 'Para el examen del jueves',
      fijado: true,
    });
    expect(aviso).toMatchObject({
      titulo: 'Traigan calculadora',
      fijado: true,
      alumnoId: null,
      destinatarios: 2,
    });
    expect(crearParaVarios).toHaveBeenCalledWith(
      [500, 501],
      expect.objectContaining({
        tipo: TipoNotificacion.AVISO_DOCENTE,
        titulo: 'Redes: Traigan calculadora',
        referenciaTipo: 'Materia',
        referenciaId: 12,
      }),
    );
  });

  it('un aviso individual sólo llega a ese alumno y no se fija', async () => {
    const aviso = await service.crear(docente, {
      materiaId: 12,
      grupoId: 3,
      alumnoId: 501,
      titulo: 'Llevas 4 faltas',
      cuerpo: 'Platiquemos',
      fijado: true,
    });
    expect(aviso).toMatchObject({ alumnoId: 501, fijado: false });
    expect((crearParaVarios.mock.calls[0] as [number[]])[0]).toEqual([501]);

    await expect(
      service.crear(docente, {
        materiaId: 12,
        grupoId: 3,
        alumnoId: 999,
        titulo: 'x',
        cuerpo: 'y',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un docente sin la materia en ese grupo no publica', async () => {
    horarioMateriaCount.mockResolvedValue(0);
    await expect(
      service.crear(docente, {
        materiaId: 12,
        grupoId: 3,
        titulo: 'x',
        cuerpo: 'y',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(avisoCreate).not.toHaveBeenCalled();
  });

  it('el alumno ve los de su grupo y los suyos; sin inscripción, nada', async () => {
    usuarioFindUnique.mockResolvedValue({ grupoId: 3 });
    inscripcionFindMany.mockResolvedValue([{ grupoId: 8 }]);
    avisoFindMany.mockResolvedValue([]);
    await service.listarAlumno(500, 12);
    expect(
      (avisoFindMany.mock.calls[0] as [{ where: unknown }])[0].where,
    ).toEqual({
      materiaId: 12,
      grupoId: { in: [3, 8] },
      OR: [{ alumnoId: null }, { alumnoId: 500 }],
    });

    inscripcionFindMany.mockResolvedValue([]);
    await expect(service.listarAlumno(500, 13)).resolves.toEqual([]);
  });

  it('no deja editar el aviso de otro docente', async () => {
    avisoFindUnique.mockResolvedValue({ id: 7, docenteId: 77 });
    await expect(
      service.editar(docente, 7, { fijado: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('suspensiones', () => {
    beforeEach(() => {
      horarioMateriaFindMany.mockResolvedValue([
        {
          dias: 'Lunes,Miércoles',
          materiaId: 12,
          grupoId: 3,
          materia: { nombre: 'Redes' },
        },
        {
          dias: 'Martes',
          materiaId: 14,
          grupoId: 4,
          materia: { nombre: 'BD' },
        },
      ]);
    });

    it('avisa una vez a cada grupo que tenía clase ese día', async () => {
      avisoFindFirst.mockResolvedValue(null);
      // 2026-10-05 es lunes: sólo Redes.
      await service.avisarSuspensiones(31, ['2026-10-05'], 'Junta de academia');
      expect(avisoCreate).toHaveBeenCalledTimes(1);
      expect(
        (avisoCreate.mock.calls[0] as [{ data: unknown }])[0].data,
      ).toMatchObject({
        materiaId: 12,
        grupoId: 3,
        suspensionFecha: '2026-10-05',
        cuerpo: 'Junta de academia',
        titulo: 'No hay clase el lunes 5 de octubre',
      });
      expect(notificacion().titulo).toBe(
        'Redes: No hay clase el lunes 5 de octubre',
      );

      // Volver a guardar la misma fecha sólo cambia el motivo.
      jest.clearAllMocks();
      inscripcionFindMany.mockResolvedValue(roster);
      horarioMateriaFindMany.mockResolvedValue([
        {
          dias: 'Lunes',
          materiaId: 12,
          grupoId: 3,
          materia: { nombre: 'Redes' },
        },
      ]);
      avisoFindFirst.mockResolvedValue({ id: 7 });
      await service.avisarSuspensiones(31, ['2026-10-05'], 'Congreso');
      expect(avisoCreate).not.toHaveBeenCalled();
      expect(avisoUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { cuerpo: 'Congreso' },
      });
      expect(crearParaVarios).not.toHaveBeenCalled();
    });

    it('al quitar la suspensión avisa que sí hay clase y borra el aviso', async () => {
      avisoFindMany.mockResolvedValue([
        { id: 7, materiaId: 12, grupoId: 3, materia: { nombre: 'Redes' } },
      ]);
      await service.retirarAvisosDeSuspension(31, '2026-10-05');
      expect(notificacion().titulo).toBe(
        'Redes: sí hay clase el lunes 5 de octubre',
      );
      expect(avisoDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: [7] } },
      });
    });

    it('un error al avisar no se propaga a la suspensión', async () => {
      horarioMateriaFindMany.mockRejectedValue(new Error('db caída'));
      await expect(
        service.avisarSuspensiones(31, ['2026-10-05'], 'x'),
      ).resolves.toBeUndefined();
    });
  });
});
