import { EstadoAsistencia } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClasesService } from '../clases/clases.service';
import { CalificacionesService } from '../calificaciones/calificaciones.service';
import { DashboardService } from './dashboard.service';

const { ASISTENCIA, FALTA, RETARDO } = EstadoAsistencia;

const ana = { id: 500, nombre: 'Ana', numeroControl: 'C1' };
const beto = { id: 501, nombre: 'Beto', numeroControl: 'C2' };
const carla = { id: 502, nombre: 'Carla', numeroControl: 'C3' };

/** Una fila (alumno × unidad) del reporte de calificaciones. */
const fila = (
  alumno: typeof ana,
  unidad: number,
  extra: Partial<{
    calificacionFinal: number | null;
    motivos: string[];
    asistencia: { registradas: number; faltas: number; retardos: number };
    tareas: { vencidas: number; vencidasSinEntregar: number };
  }> = {},
) => ({
  alumno,
  unidad: { id: 60 + unidad, nombre: `Unidad ${unidad}` },
  calificacionFinal: 90,
  motivos: [],
  asistencia: { registradas: 5, faltas: 0, retardos: 0 },
  tareas: { vencidas: 2, vencidasSinEntregar: 0 },
  ...extra,
});

describe('DashboardService riesgo del docente', () => {
  const asistenciaFindMany = jest.fn();
  const materiaFindMany = jest.fn();
  const avisoFindMany = jest.fn();
  const entregaFindMany = jest.fn();
  const inscripcionFindMany = jest.fn();
  const inscripcionCount = jest.fn();
  const grupoFindMany = jest.fn();
  const horarioCount = jest.fn();
  const obtenerReporteDocente = jest.fn();
  const prisma = {
    asistencia: { findMany: asistenciaFindMany },
    materia: { findMany: materiaFindMany },
    aviso: { findMany: avisoFindMany },
    entregaTarea: { findMany: entregaFindMany },
    inscripcion: { findMany: inscripcionFindMany, count: inscripcionCount },
    grupo: { findMany: grupoFindMany },
    horarioMateria: { count: horarioCount },
  } as unknown as PrismaService;
  const clases = {
    obtenerPanelDocente: jest.fn().mockResolvedValue({ clasesHoy: [] }),
  } as unknown as ClasesService;
  const service = new DashboardService(prisma, clases, {
    obtenerReporteDocente,
  } as unknown as CalificacionesService);

  const redes = {
    id: 12,
    nombre: 'Redes',
    clave: 'RED-1',
    unidades: [],
    horarios: [{ grupo: { id: 3, nombre: '8A' } }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindMany.mockResolvedValue([redes]);
    grupoFindMany.mockResolvedValue([]);
    horarioCount.mockResolvedValue(0);
    obtenerReporteDocente.mockResolvedValue({
      rows: [
        // Ana: solo debe tareas; con el criterio anterior no aparecía.
        fila(ana, 1),
        fila(ana, 2, {
          motivos: ['ENTREGAS'],
          tareas: { vencidas: 3, vencidasSinEntregar: 2 },
        }),
        // Beto reprueba la unidad 1 y además falta.
        fila(beto, 1, {
          calificacionFinal: 60,
          motivos: ['CALIFICACION_BAJA', 'ASISTENCIA'],
          asistencia: { registradas: 5, faltas: 2, retardos: 1 },
        }),
        fila(beto, 2, { calificacionFinal: 75 }),
        fila(carla, 1),
      ],
    });
    asistenciaFindMany.mockResolvedValue(
      [ASISTENCIA, FALTA, RETARDO, FALTA, ASISTENCIA].map((estado) => ({
        estado,
        alumnoId: 501,
        claseSesion: { materiaId: 12, grupoId: 3 },
      })),
    );
    avisoFindMany.mockResolvedValue([
      {
        id: 70,
        titulo: 'Tu asistencia',
        createdAt: new Date(2026, 8, 20),
        materiaId: 12,
        grupoId: 3,
        alumnoId: 501,
      },
    ]);
  });

  it('lista con el criterio único: reprobados primero, con unidad, motivos, tendencia y aviso', async () => {
    const { alumnos, criterio, clasesSinDatos } =
      await service.obtenerRiesgoDocente(31);

    expect(obtenerReporteDocente).toHaveBeenCalledWith(
      { id: 31, rol: 'DOCENTE' },
      { materiaId: 12, grupoId: 3 },
    );
    expect(criterio).toMatchObject({
      minRegistros: 3,
      porcentaje: 30,
      minTareas: 2,
      porcentajeEntregas: 30,
    });
    expect(clasesSinDatos).toEqual([]);
    expect(alumnos.map((a) => a.alumno.nombre)).toEqual(['Beto', 'Ana']);
    expect(alumnos[0]).toMatchObject({
      materia: { id: 12, nombre: 'Redes' },
      grupo: { id: 3, nombre: '8A' },
      motivos: ['CALIFICACION_BAJA', 'ASISTENCIA'],
      unidades: [{ id: 61, nombre: 'Unidad 1', calificacion: 60 }],
      calificacion: 67.5,
      registros: 10,
      faltas: 2,
      retardos: 1,
      porcentajeAusencias: 30,
      // Las últimas 4 sesiones, de la más antigua a la más reciente.
      tendencia: [FALTA, RETARDO, FALTA, ASISTENCIA],
      ultimoAviso: { id: 70, titulo: 'Tu asistencia' },
    });
    expect(alumnos[1]).toMatchObject({
      motivos: ['ENTREGAS'],
      tareasVencidas: 5,
      tareasSinEntregar: 2,
      ultimoAviso: null,
    });
  });

  it('una clase cuyo reporte falla se informa aparte, no como «sin riesgo»', async () => {
    obtenerReporteDocente.mockRejectedValue(new Error('caído'));
    const resultado = await service.obtenerRiesgoDocente(31);
    expect(resultado.alumnos).toEqual([]);
    expect(resultado.clasesSinDatos).toEqual([
      { materia: { id: 12, nombre: 'Redes' }, grupo: { id: 3, nombre: '8A' } },
    ]);
  });

  it('filtra por clase y no consulta asistencias si nadie está en riesgo', async () => {
    const resultado = await service.obtenerRiesgoDocente(31, {
      materiaId: 99,
    });
    expect(resultado.alumnos).toEqual([]);
    expect(obtenerReporteDocente).not.toHaveBeenCalled();
    expect(asistenciaFindMany).not.toHaveBeenCalled();
  });

  it('el panel cuenta el riesgo de cada clase con el mismo cálculo', async () => {
    asistenciaFindMany.mockResolvedValue([]);
    entregaFindMany.mockResolvedValue([]);
    inscripcionFindMany.mockResolvedValue([]);
    inscripcionCount.mockResolvedValue(0);
    const panel = await service.obtenerPanelDocente(31);
    expect(panel.pendientes.alumnosEnRiesgo).toBe(2);
    expect(panel.materias[0]).toMatchObject({
      alumnosEnRiesgo: 2,
      riesgo: {
        evaluados: 3,
        enRiesgo: 2,
        reprobando: 1,
        motivos: { calificacion: 1, asistencia: 1, entregas: 1 },
      },
    });
  });

  it('el panel dice qué le falta configurar al docente', async () => {
    asistenciaFindMany.mockResolvedValue([]);
    entregaFindMany.mockResolvedValue([]);
    inscripcionFindMany.mockResolvedValue([]);
    inscripcionCount.mockResolvedValue(0);
    grupoFindMany.mockResolvedValue([
      { id: 3, nombre: '8A', _count: { alumnos: 0 } },
    ]);
    horarioCount.mockResolvedValue(0);
    const panel = await service.obtenerPanelDocente(31);
    expect(panel.configuracion).toEqual({
      grupos: [{ id: 3, nombre: '8A', alumnos: 0 }],
      clasesProgramadas: 0,
    });
  });
});
