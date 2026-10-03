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
  const categoriaPesoGrupoCount = jest.fn();
  const ponderacionGrupoUpsert = jest.fn();
  const asistenciaFindMany = jest.fn();
  const participacionFindMany = jest.fn();
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
    ponderacionGrupo: {
      findMany: ponderacionGrupoFindMany,
      upsert: ponderacionGrupoUpsert,
    },
    categoriaEvaluacion: { findMany: categoriaFindMany },
    categoriaPesoGrupo: { count: categoriaPesoGrupoCount },
    tarea: { findMany: tareaFindMany },
    claseSesion: { findMany: claseSesionFindMany },
    asistencia: { findMany: asistenciaFindMany },
    participacion: { findMany: participacionFindMany },
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
    categoriaPesoGrupoCount.mockResolvedValue(0);
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

  describe('criterios por grupo', () => {
    const admin = { id: 1, rol: 'ADMIN' };
    type FilaReporte = {
      alumno: { nombre: string; sexo: string | null };
      promedioTareas: number | null;
      calificacionCalculada: number | null;
      promedioPorCategoria: unknown[];
      criterios: unknown[];
      origenCriterios: string;
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
    const criterio = (
      id: number,
      nombre: string,
      tipo: string,
      pesos: Array<{ grupoId: number; peso: number }>,
    ) => ({
      id,
      nombre,
      tipo,
      orden: id,
      pesos: pesos.map((fila) => ({ ...fila, meta: null })),
      pesosUnidad: [],
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
        { alumno: { id: 500, nombre: 'Ana', grupoId: 3, sexo: 'MUJER' } },
        { alumno: { id: 501, nombre: 'Beto', grupoId: 4, sexo: 'HOMBRE' } },
        { alumno: { id: 502, nombre: 'Carla', grupoId: 3, sexo: null } },
      ]);
      // 8A: examen 48 + prácticas 32 + asistencia 20 = 100. 8B no tiene criterios.
      categoriaFindMany.mockResolvedValue([
        criterio(1, 'Examen', 'EXAMEN', [{ grupoId: 3, peso: 48 }]),
        criterio(2, 'Prácticas', 'PRACTICAS', [{ grupoId: 3, peso: 32 }]),
        criterio(3, 'Asistencia', 'ASISTENCIA', [{ grupoId: 3, peso: 20 }]),
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

    it('pondera por criterio en el grupo que los tiene y usa la predeterminada en el que no', async () => {
      const reporte = await service.obtenerReporteDocente(admin, {
        materiaId: 12,
      });
      const rows = reporte.rows as FilaReporte[];
      const fila = (nombre: string) =>
        rows.find((row) => row.alumno.nombre === nombre) as FilaReporte;

      // Examen 100 × 48 + prácticas (50 + 70) / 2 × 32, repartido entre lo que
      // tiene valor (sin clases todavía, la asistencia no cuenta).
      expect(fila('Ana').promedioTareas).toBe(84);
      expect(fila('Ana').calificacionCalculada).toBe(84);
      expect(fila('Ana').alumno.sexo).toBe('MUJER');
      expect(fila('Ana').origenCriterios).toBe('GRUPO');
      expect(fila('Ana').criterios).toEqual([
        expect.objectContaining({
          nombre: 'Examen',
          peso: 48,
          valor: 100,
          calificadas: 1,
          total: 1,
        }),
        expect.objectContaining({
          nombre: 'Prácticas',
          peso: 32,
          valor: 60,
          calificadas: 2,
          total: 2,
        }),
        expect.objectContaining({
          nombre: 'Asistencia',
          peso: 20,
          valor: null,
        }),
      ]);
      expect(fila('Ana').promedioPorCategoria).toEqual([
        expect.objectContaining({ nombre: 'Examen', peso: 48, promedio: 100 }),
        expect.objectContaining({ nombre: 'Prácticas', promedio: 60 }),
      ]);
      // Sólo hay examen calificado: su peso se reparte entre lo calificado.
      expect(fila('Carla').promedioTareas).toBe(90);
      // 8B no tiene criterios: promedio simple de todo, como siempre.
      expect(fila('Beto').promedioTareas).toBe(75);
      expect(fila('Beto').origenCriterios).toBe('PREDETERMINADA');
      expect(fila('Beto').promedioPorCategoria).toEqual([]);
      expect(reporte.tareasSinCategoria).toBe(1);
      expect(reporte.categorias).toEqual([
        { id: 1, nombre: 'Examen', tipo: 'EXAMEN' },
        { id: 2, nombre: 'Prácticas', tipo: 'PRACTICAS' },
      ]);
    });

    it('manda la ponderación anterior armada con los criterios del grupo', async () => {
      ponderacionGrupoFindMany.mockResolvedValue([
        { materiaId: 12, grupoId: 4, pesoTareas: 50, pesoAsistencia: 50 },
      ]);
      const conCriterios = await service.obtenerReporteDocente(admin, {
        materiaId: 12,
        grupoId: 3,
      });
      expect(conCriterios.ponderacion).toEqual({
        tareas: 80,
        asistencia: 20,
        categorias: [
          { id: 1, nombre: 'Examen', peso: 48 },
          { id: 2, nombre: 'Prácticas', peso: 32 },
        ],
        origen: 'GRUPO',
      });

      const predeterminada = await service.obtenerReporteDocente(admin, {
        materiaId: 12,
        grupoId: 4,
      });
      expect(predeterminada.ponderacion).toEqual({
        tareas: 50,
        asistencia: 50,
        categorias: [],
        origen: 'GRUPO',
      });
      expect(predeterminada.criterios).toEqual(
        expect.objectContaining({ origen: 'PREDETERMINADA', legado: 'GRUPO' }),
      );
    });

    it('una pantalla vieja no puede guardar categorías ni pisar los criterios', async () => {
      const base = { materiaId: 12, pesoTareas: 80, pesoAsistencia: 20 };
      await expect(
        service.guardarPonderacion(admin, {
          ...base,
          grupoId: 3,
          categorias: [{ nombre: 'Examen', peso: 100 }],
        }),
      ).rejects.toThrow('Recarga la página');

      categoriaPesoGrupoCount.mockResolvedValue(3);
      await expect(
        service.guardarPonderacion(admin, { ...base, grupoId: 3 }),
      ).rejects.toThrow('Recarga la página');
      expect(ponderacionGrupoUpsert).not.toHaveBeenCalled();

      categoriaPesoGrupoCount.mockResolvedValue(0);
      categoriaFindMany.mockResolvedValue([]);
      materiaFindUnique.mockResolvedValue({
        id: 12,
        pesoTareas: 80,
        pesoAsistencia: 20,
      });
      ponderacionGrupoFindMany.mockResolvedValue([
        { materiaId: 12, grupoId: 4, pesoTareas: 60, pesoAsistencia: 40 },
      ]);
      await expect(
        service.guardarPonderacion(admin, {
          materiaId: 12,
          grupoId: 4,
          pesoTareas: 60,
          pesoAsistencia: 40,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          tareas: 60,
          asistencia: 40,
          origen: 'GRUPO',
        }),
      );
      expect(ponderacionGrupoUpsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('desempeño por unidad', () => {
    const admin = { id: 1, rol: 'ADMIN' };
    const asistencia = (
      alumnoId: number,
      claseSesionId: number,
      estado: string,
    ) => ({
      alumnoId,
      claseSesionId,
      estado,
    });

    beforeEach(() => {
      materiaFindUnique.mockResolvedValue({
        ...materia,
        nombre: 'Redes',
        clave: 'RED-1',
        numUnidades: 2,
        pesoTareas: 80,
        pesoAsistencia: 20,
        grupos: [{ id: 3, nombre: '8A' }],
        unidades: [
          { id: 5, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' },
          { id: 6, nombre: 'Unidad 2', orden: 2, status: 'ACTIVA' },
        ],
      });
      inscripcionFindMany.mockResolvedValue([
        { alumno: { id: 500, nombre: 'Ana', grupoId: 3 } },
        { alumno: { id: 501, nombre: 'Beto', grupoId: 3 } },
        { alumno: { id: 502, nombre: 'Carla', grupoId: 3 } },
      ]);
      tareaFindMany.mockResolvedValue([
        {
          id: 20,
          grupoId: 3,
          unidadId: 6,
          unidad: 2,
          categoriaId: null,
          grupo: { id: 3, nombre: '8A' },
          entregas: [
            { alumnoId: 500, estadoRevision: 'CALIFICADA', calificacion: 95 },
            { alumnoId: 501, estadoRevision: 'CALIFICADA', calificacion: 75 },
            { alumnoId: 502, estadoRevision: 'CALIFICADA', calificacion: 76 },
          ],
        },
      ]);
      claseSesionFindMany.mockResolvedValue(
        [900, 901, 902].map((id) => ({
          id,
          grupoId: 3,
          unidadId: 6,
          unidad: 2,
        })),
      );
      asistenciaFindMany.mockResolvedValue([
        asistencia(500, 900, 'ASISTENCIA'),
        asistencia(500, 901, 'ASISTENCIA'),
        asistencia(500, 902, 'ASISTENCIA'),
        asistencia(501, 900, 'ASISTENCIA'),
        asistencia(501, 901, 'FALTA'),
        asistencia(501, 902, 'FALTA'),
      ]);
      participacionFindMany.mockResolvedValue([]);
      calificacionFindMany.mockResolvedValue([]);
    });

    it('usa la unidad en curso y pinta el semáforo de cada alumno', async () => {
      const vista = await service.obtenerDesempeno(admin, {
        materiaId: 12,
        grupoId: 3,
      });
      expect(vista.unidad).toEqual(
        expect.objectContaining({ id: 6, orden: 2 }),
      );
      expect(vista.criterios.map((item) => [item.clave, item.peso])).toEqual([
        ['tareas', 80],
        ['asistencia', 20],
      ]);
      expect(vista.origenCriterios).toBe('PREDETERMINADA');
      expect(vista.resumen).toEqual({
        total: 3,
        aprobados: 1,
        enRiesgo: 1,
        reprobados: 1,
        sinCalificar: 0,
      });
      const alumno = (nombre: string) =>
        vista.alumnos.find((item) => item.alumno.nombre === nombre);
      // (95 × 80 + 100 × 20) / 100
      expect(alumno('Ana')).toEqual(
        expect.objectContaining({ calificacion: 96, desempeno: 'APROBADO' }),
      );
      expect(alumno('Ana')?.criterios).toEqual([
        { clave: 'tareas', valor: 95, calificadas: 1, total: 1 },
        { clave: 'asistencia', valor: 100, calificadas: 3, total: 3 },
      ]);
      // (75 × 80 + 33 × 20) / 100 = 66.6; además faltó 2 de 3.
      expect(alumno('Beto')).toEqual(
        expect.objectContaining({
          calificacion: 67,
          desempeno: 'REPROBADO',
          motivos: ['CALIFICACION_BAJA', 'ASISTENCIA'],
        }),
      );
      // Sin registros de asistencia sólo cuenta la tarea.
      expect(alumno('Carla')).toEqual(
        expect.objectContaining({
          calificacion: 76,
          desempeno: 'EN_RIESGO',
          motivos: ['CALIFICACION_LIMITE'],
          asistencia: expect.objectContaining({ porcentaje: null }),
        }),
      );
    });

    it('en una unidad cerrada sólo hay aprobados y reprobados', async () => {
      tareaFindMany.mockResolvedValue([]);
      claseSesionFindMany.mockResolvedValue([]);
      calificacionFindMany.mockResolvedValue([
        {
          alumnoId: 500,
          unidadId: 5,
          calificacionManual: 75,
          observacion: null,
        },
      ]);
      const vista = await service.obtenerDesempeno(admin, {
        materiaId: 12,
        grupoId: 3,
        unidadId: 5,
      });
      expect(vista.unidad?.id).toBe(5);
      expect(vista.resumen).toEqual(
        expect.objectContaining({ aprobados: 1, enRiesgo: 0, sinCalificar: 2 }),
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
