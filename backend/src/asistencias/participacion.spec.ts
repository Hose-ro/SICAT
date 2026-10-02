import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PeriodosService } from '../periodos/periodos.service';
import { AsistenciasService } from './asistencias.service';

describe('AsistenciasService.registrarParticipacion', () => {
  const sesionFindUnique = jest.fn();
  const asistenciaFindMany = jest.fn();
  const usuarioFindMany = jest.fn();
  const inscripcionFindMany = jest.fn();
  const participacionFindUnique = jest.fn();
  const participacionUpsert = jest.fn();
  const participacionDelete = jest.fn();
  const prisma = {
    claseSesion: { findUnique: sesionFindUnique },
    asistencia: { findMany: asistenciaFindMany },
    usuario: { findMany: usuarioFindMany },
    inscripcion: { findMany: inscripcionFindMany },
    participacion: {
      findUnique: participacionFindUnique,
      upsert: participacionUpsert,
      delete: participacionDelete,
    },
  } as unknown as PrismaService;
  const service = new AsistenciasService(
    prisma,
    {} as NotificacionesService,
    {} as PeriodosService,
  );
  const docente = { id: 31, rol: 'DOCENTE' };
  const clave = {
    claseSesionId_alumnoId: { claseSesionId: 10, alumnoId: 500 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sesionFindUnique.mockResolvedValue({
      id: 10,
      docenteId: 31,
      materiaId: 12,
      grupoId: 3,
    });
    asistenciaFindMany.mockResolvedValue([]);
    usuarioFindMany.mockResolvedValue([{ id: 500 }]);
    inscripcionFindMany.mockResolvedValue([]);
    participacionUpsert.mockImplementation(
      ({ create }: { create: { alumnoId: number; puntos: number } }) =>
        Promise.resolve({ alumnoId: create.alumnoId, puntos: create.puntos }),
    );
  });

  it('suma un punto sobre lo que ya tenía', async () => {
    participacionFindUnique.mockResolvedValue({ puntos: 2, nota: null });
    await service.registrarParticipacion(10, docente, {
      alumnoId: 500,
      delta: 1,
    });
    expect(participacionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: clave,
        update: { puntos: 3, nota: null },
      }),
    );
  });

  it('al bajar a cero sin nota borra el registro, y nunca queda negativo', async () => {
    participacionFindUnique.mockResolvedValue({ puntos: 1, nota: null });
    await expect(
      service.registrarParticipacion(10, docente, { alumnoId: 500, delta: -3 }),
    ).resolves.toEqual({ alumnoId: 500, puntos: 0, nota: null });
    expect(participacionDelete).toHaveBeenCalledWith({ where: clave });
    expect(participacionUpsert).not.toHaveBeenCalled();
  });

  it('sólo el docente de la sesión y sólo con alumnos de la clase', async () => {
    await expect(
      service.registrarParticipacion(
        10,
        { id: 77, rol: 'DOCENTE' },
        {
          alumnoId: 500,
          delta: 1,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.registrarParticipacion(10, docente, { alumnoId: 999, delta: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
