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
  const ponderacionGrupoFindMany = jest.fn();
  const categoriaFindMany = jest.fn();
  const tareaFindMany = jest.fn();
  const claseSesionFindMany = jest.fn();
  const calificacionFindMany = jest.fn();
  const prisma = {
    materia: {
      findUnique: materiaFindUnique,
      count: materiaCount,
      update: materiaUpdate,
    },
    horarioMateria: { count: horarioMateriaCount },
    inscripcion: { findMany: inscripcionFindMany },
    calificacionUnidad: {
      upsert: calificacionUpsert,
      findMany: calificacionFindMany,
    },
    ponderacionGrupo: { findMany: ponderacionGrupoFindMany },
    categoriaEvaluacion: { findMany: categoriaFindMany },
    tarea: { findMany: tareaFindMany },
    claseSesion: { findMany: claseSesionFindMany },
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
    ponderacionGrupoFindMany.mockResolvedValue([]);
    categoriaFindMany.mockResolvedValue([]);
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

      materiaFindUnique.mockResolvedValueOnce({
        id: 12,
        pesoTareas: 70,
        pesoAsistencia: 30,
      });
      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 30,
        }),
      ).resolves.toEqual({
        tareas: 70,
        asistencia: 30,
        categorias: [],
        origen: 'MATERIA',
        catalogo: [],
      });
      expect(materiaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 12 },
          data: { pesoTareas: 70, pesoAsistencia: 30 },
        }),
      );
    });
  });

  describe('categorías por grupo', () => {
    const admin = { id: 1, rol: 'ADMIN' };
    type FilaReporte = {
      alumno: { nombre: string };
      promedioTareas: number | null;
      calificacionCalculada: number | null;
      promedioPorCategoria: unknown[];
    };
    const tarea = (
      id: number,
      categoriaId: number | null,
      notas: Record<number, number>,
    ) => ({
      id,
      grupoId: null,
      unidadId: 5,
      unidad: 1,
      categoriaId,
      grupo: null,
      entregas: Object.entries(notas).map(([alumnoId, calificacion]) => ({
        alumnoId: Number(alumnoId),
        estadoRevision: 'CALIFICADA',
        calificacion,
      })),
    });

    beforeEach(() => {
      materiaFindUnique.mockResolvedValue({
        ...materia,
        pesoTareas: 80,
        pesoAsistencia: 20,
        grupos: [
          { id: 3, nombre: '8A' },
          { id: 4, nombre: '8B' },
        ],
      });
      inscripcionFindMany.mockResolvedValue([
        { alumno: { id: 500, nombre: 'Ana', grupoId: 3 } },
        { alumno: { id: 501, nombre: 'Beto', grupoId: 4 } },
        { alumno: { id: 502, nombre: 'Carla', grupoId: 3 } },
      ]);
      categoriaFindMany.mockResolvedValue([
        { id: 1, nombre: 'Examen', pesos: [{ grupoId: 3, peso: 60 }] },
        { id: 2, nombre: 'Prácticas', pesos: [{ grupoId: 3, peso: 40 }] },
      ]);
      tareaFindMany.mockResolvedValue([
        tarea(10, 1, { 500: 100, 501: 100, 502: 90 }),
        tarea(11, 2, { 500: 50, 501: 50 }),
        tarea(12, 2, { 500: 70 }),
        tarea(13, null, { 500: 0 }),
      ]);
      claseSesionFindMany.mockResolvedValue([]);
      calificacionFindMany.mockResolvedValue([]);
    });

    it('pondera por categoría en el grupo que las tiene y promedia simple en el que no', async () => {
      const reporte = await service.obtenerReporteDocente(admin, {
        materiaId: 12,
      });
      const rows = reporte.rows as FilaReporte[];
      const fila = (nombre: string) =>
        rows.find((row) => row.alumno.nombre === nombre) as FilaReporte;

      // Examen 100 × 60 + prácticas (50 + 70) / 2 × 40; la tarea sin categoría no cuenta.
      expect(fila('Ana').promedioTareas).toBe(84);
      expect(fila('Ana').calificacionCalculada).toBe(84);
      expect(fila('Ana').promedioPorCategoria).toEqual([
        expect.objectContaining({ nombre: 'Examen', peso: 60, promedio: 100 }),
        expect.objectContaining({ nombre: 'Prácticas', promedio: 60 }),
      ]);
      // Sólo hay examen calificado: su peso se reparte entre lo calificado.
      expect(fila('Carla').promedioTareas).toBe(90);
      // 8B no tiene categorías: promedio simple, como siempre.
      expect(fila('Beto').promedioTareas).toBe(75);
      expect(fila('Beto').promedioPorCategoria).toEqual([]);
      expect(reporte.tareasSinCategoria).toBe(1);
      expect(reporte.categorias).toEqual([
        { id: 1, nombre: 'Examen' },
        { id: 2, nombre: 'Prácticas' },
      ]);
    });

    it('usa la ponderación propia del grupo filtrado', async () => {
      ponderacionGrupoFindMany.mockResolvedValue([
        { materiaId: 12, grupoId: 3, pesoTareas: 50, pesoAsistencia: 50 },
      ]);
      const reporte = await service.obtenerReporteDocente(admin, {
        materiaId: 12,
        grupoId: 3,
      });
      expect(reporte.ponderacion).toEqual({
        tareas: 50,
        asistencia: 50,
        categorias: [
          { id: 1, nombre: 'Examen', peso: 60 },
          { id: 2, nombre: 'Prácticas', peso: 40 },
        ],
        origen: 'GRUPO',
      });
    });

    it('exige grupo y que los pesos de las categorías sumen 100', async () => {
      const base = { materiaId: 12, pesoTareas: 80, pesoAsistencia: 20 };
      await expect(
        service.guardarPonderacion(admin, {
          ...base,
          categorias: [{ nombre: 'Examen', peso: 100 }],
        }),
      ).rejects.toThrow('Elige un grupo');
      await expect(
        service.guardarPonderacion(admin, {
          ...base,
          grupoId: 3,
          categorias: [
            { nombre: 'Examen', peso: 60 },
            { nombre: 'Prácticas', peso: 30 },
          ],
        }),
      ).rejects.toThrow('deben sumar 100');
      expect(transaction).not.toHaveBeenCalled();
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
