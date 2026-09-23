import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CalificacionesService } from './calificaciones.service';

describe('CalificacionesService: política docente–materia–grupo', () => {
  const materiaFindUnique = jest.fn();
  const materiaCount = jest.fn();
  const materiaUpdate = jest.fn();
  const horarioMateriaCount = jest.fn();
  const inscripcionFindMany = jest.fn();
  const calificacionUpsert = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    materia: {
      findUnique: materiaFindUnique,
      count: materiaCount,
      update: materiaUpdate,
    },
    horarioMateria: { count: horarioMateriaCount },
    inscripcion: { findMany: inscripcionFindMany },
    calificacionUnidad: { upsert: calificacionUpsert },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new CalificacionesService(prisma);

  const docente = { id: 31, rol: 'DOCENTE' };
  const materia = {
    id: 12,
    docenteId: 99,
    grupos: [{ id: 3, nombre: '8A' }],
    unidades: [{ id: 5, orden: 1, nombre: 'Unidad 1' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindUnique.mockResolvedValue(materia);
    // asegurarAccesoMateria: existe (where sin docenteId) / asignación directa (con docenteId)
    materiaCount.mockImplementation(
      ({ where }: { where: { docenteId?: number } }) =>
        Promise.resolve('docenteId' in where ? 0 : 1),
    );
    horarioMateriaCount.mockResolvedValue(0);
    materiaUpdate.mockResolvedValue({ id: 12 });
    inscripcionFindMany.mockResolvedValue([
      { alumno: { id: 500, nombre: 'Ana', numeroControl: 'C1', grupoId: 3 } },
      { alumno: { id: 501, nombre: 'Beto', numeroControl: 'C2', grupoId: 3 } },
    ]);
    calificacionUpsert.mockImplementation((args: unknown) => args);
    transaction.mockResolvedValue([]);
  });

  it('el reporte se niega a un docente que no imparte la materia en el grupo pedido', async () => {
    await expect(
      service.obtenerReporteDocente(docente, { materiaId: 12, grupoId: 3 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(horarioMateriaCount).toHaveBeenCalledWith({
      where: { materiaId: 12, docenteId: docente.id, activo: true, grupoId: 3 },
    });
  });

  it('la captura manual se niega con la misma política', async () => {
    await expect(
      service.guardarManual(docente, {
        materiaId: 12,
        grupoId: 3,
        unidadId: 5,
        alumnoId: 500,
        calificacionManual: 90,
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un docente con horario activo en ese grupo pasa la verificación de acceso', async () => {
    horarioMateriaCount.mockResolvedValue(1);
    // Sin más mocks el reporte falla después del control de acceso; sólo nos
    // interesa que ya no sea un 403.
    await expect(
      service.obtenerReporteDocente(docente, { materiaId: 12, grupoId: 3 }),
    ).rejects.not.toBeInstanceOf(ForbiddenException);
  });

  describe('ponderación persistida por materia', () => {
    it('la guarda sólo quien imparte la materia y exige que sume 100', async () => {
      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 30,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(materiaUpdate).not.toHaveBeenCalled();

      horarioMateriaCount.mockResolvedValue(1);
      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 40,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 30,
        }),
      ).resolves.toEqual({ tareas: 70, asistencia: 30 });
      expect(materiaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 12 },
          data: { pesoTareas: 70, pesoAsistencia: 30 },
        }),
      );
    });
  });

  describe('captura por lote', () => {
    const lote = (calificaciones: object[]) => ({
      materiaId: 12,
      grupoId: 3,
      calificaciones,
    });

    beforeEach(() => horarioMateriaCount.mockResolvedValue(1));

    it('guarda todo en una transacción y arma el reporte una sola vez', async () => {
      const reporte = jest
        .spyOn(service as never, 'construirReporte')
        .mockResolvedValue('reporte' as never);

      await expect(
        service.guardarManualLote(
          docente,
          lote([
            { alumnoId: 500, unidadId: 5, calificacionManual: 90 },
            {
              alumnoId: 501,
              unidadId: 5,
              calificacionManual: null,
              observacion: ' ok ',
            },
          ]) as never,
        ),
      ).resolves.toBe('reporte');

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
      ]);
      expect(calificacionUpsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          update: {
            grupoId: 3,
            calificacionManual: null,
            observacion: 'ok',
            docenteId: docente.id,
          },
        }),
      );
      expect(reporte).toHaveBeenCalledTimes(1);
      reporte.mockRestore();
    });

    it('no escribe nada si un alumno o una unidad no pertenecen a la materia', async () => {
      await expect(
        service.guardarManualLote(
          docente,
          lote([
            { alumnoId: 500, unidadId: 5, calificacionManual: 90 },
            { alumnoId: 999, unidadId: 5, calificacionManual: 80 },
          ]) as never,
        ),
      ).rejects.toThrow('El alumno no pertenece a la materia seleccionada');
      await expect(
        service.guardarManualLote(
          docente,
          lote([
            { alumnoId: 500, unidadId: 77, calificacionManual: 90 },
          ]) as never,
        ),
      ).rejects.toThrow('La unidad no pertenece a la materia seleccionada');
      expect(transaction).not.toHaveBeenCalled();
    });
  });
});
