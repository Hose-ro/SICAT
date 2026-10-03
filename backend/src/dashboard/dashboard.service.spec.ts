import { EstadoAsistencia } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClasesService } from '../clases/clases.service';
import { DashboardService } from './dashboard.service';

const { ASISTENCIA, FALTA, RETARDO } = EstadoAsistencia;

describe('DashboardService.obtenerRiesgoDocente', () => {
  const asistenciaFindMany = jest.fn();
  const materiaFindMany = jest.fn();
  const grupoFindMany = jest.fn();
  const tareaFindMany = jest.fn();
  const avisoFindMany = jest.fn();
  const prisma = {
    asistencia: { findMany: asistenciaFindMany },
    materia: { findMany: materiaFindMany },
    grupo: { findMany: grupoFindMany },
    tarea: { findMany: tareaFindMany },
    aviso: { findMany: avisoFindMany },
  } as unknown as PrismaService;
  const service = new DashboardService(prisma, {} as ClasesService);

  const ana = { id: 500, nombre: 'Ana', numeroControl: 'C1' };
  const beto = { id: 501, nombre: 'Beto', numeroControl: 'C2' };
  const registro = (
    alumno: typeof ana,
    estado: EstadoAsistencia,
    dia: number,
  ) => ({
    estado,
    alumno,
    claseSesion: {
      materiaId: 12,
      grupoId: 3,
      fecha: new Date(2026, 8, dia),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindMany.mockResolvedValue([{ id: 12, nombre: 'Redes' }]);
    grupoFindMany.mockResolvedValue([{ id: 3, nombre: '8A' }]);
    tareaFindMany.mockResolvedValue([
      { id: 1, materiaId: 12, grupoId: 3, entregas: [{ alumnoId: 500 }] },
      { id: 2, materiaId: 12, grupoId: null, entregas: [] },
      { id: 3, materiaId: 12, grupoId: 9, entregas: [] },
    ]);
    avisoFindMany.mockResolvedValue([
      {
        id: 70,
        titulo: 'Tu asistencia',
        createdAt: new Date(2026, 8, 20),
        materiaId: 12,
        grupoId: 3,
        alumnoId: 500,
      },
    ]);
  });

  it('lista sólo a quien cumple el criterio, con tendencia, tareas y último aviso', async () => {
    asistenciaFindMany.mockResolvedValue([
      registro(ana, ASISTENCIA, 1),
      registro(ana, FALTA, 2),
      registro(ana, RETARDO, 3),
      registro(ana, FALTA, 4),
      registro(ana, ASISTENCIA, 5),
      // Beto: 1 de 4, por debajo del 30 %.
      registro(beto, ASISTENCIA, 1),
      registro(beto, ASISTENCIA, 2),
      registro(beto, FALTA, 3),
      registro(beto, ASISTENCIA, 4),
    ]);

    const { alumnos, criterio } = await service.obtenerRiesgoDocente(31);

    expect(criterio).toEqual({ minRegistros: 3, porcentaje: 30 });
    expect(alumnos).toHaveLength(1);
    expect(alumnos[0]).toMatchObject({
      alumno: ana,
      materia: { id: 12, nombre: 'Redes' },
      grupo: { id: 3, nombre: '8A' },
      registros: 5,
      faltas: 2,
      retardos: 1,
      porcentajeAusencias: 60,
      // Las últimas 4 sesiones, de la más antigua a la más reciente.
      tendencia: [FALTA, RETARDO, FALTA, ASISTENCIA],
      // La del grupo 9 no es de su clase; la de toda la materia sí.
      tareasVencidas: 2,
      tareasSinEntregar: 1,
      ultimoAviso: { id: 70, titulo: 'Tu asistencia' },
    });
  });

  it('una actividad en clase sólo cuenta como pendiente si el alumno no presentó', async () => {
    tareaFindMany.mockResolvedValue([
      // Examen en clase todavía sin calificar: no es culpa del alumno.
      {
        id: 4,
        materiaId: 12,
        grupoId: 3,
        tipoEntrega: 'PRESENCIAL',
        entregas: [],
      },
      // Exposición en la que quedó registrado que no presentó.
      {
        id: 5,
        materiaId: 12,
        grupoId: 3,
        tipoEntrega: 'PRESENCIAL',
        entregas: [{ alumnoId: 500, estadoRevision: 'NO_ENTREGADA' }],
      },
      {
        id: 6,
        materiaId: 12,
        grupoId: 3,
        tipoEntrega: 'EN_LINEA',
        entregas: [],
      },
    ]);
    asistenciaFindMany.mockResolvedValue([
      registro(ana, FALTA, 1),
      registro(ana, FALTA, 2),
      registro(ana, ASISTENCIA, 3),
    ]);
    const { alumnos } = await service.obtenerRiesgoDocente(31);
    expect(alumnos[0]).toMatchObject({
      tareasVencidas: 3,
      tareasSinEntregar: 2,
    });
  });

  it('filtra por el periodo en curso y no consulta lo demás si nadie está en riesgo', async () => {
    asistenciaFindMany.mockResolvedValue([registro(beto, ASISTENCIA, 1)]);
    const resultado = await service.obtenerRiesgoDocente(31, {
      materiaId: 12,
      grupoId: 3,
    });
    expect(resultado.alumnos).toEqual([]);
    const { where } = (
      asistenciaFindMany.mock.calls[0] as [
        { where: { claseSesion: Record<string, unknown> } },
      ]
    )[0];
    expect(where.claseSesion).toMatchObject({
      docenteId: 31,
      materiaId: 12,
      grupoId: 3,
    });
    expect((where.claseSesion.fecha as { gte: Date }).gte).toBeInstanceOf(Date);
    expect(tareaFindMany).not.toHaveBeenCalled();
  });
});
