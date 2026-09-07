import { Injectable } from '@nestjs/common';
import { EstadoAsistencia, EstadoRevision, EstadoUnidad } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClasesService } from '../clases/clases.service';
import { materiasDelDocenteWhere } from '../common/materia-ownership';
import { getCurrentAcademicPeriod } from '../common/periodo.util';

/**
 * Mismo criterio que usa la jefatura de carrera para marcar a un alumno en
 * riesgo (ver JefesCarreraService): al menos 3 registros y 30% o más entre
 * faltas y retardos. Aquí se aplica por materia, que es lo accionable para el
 * docente: el mismo alumno puede ir bien en una y mal en otra.
 */
const MIN_REGISTROS_RIESGO = 3;
const UMBRAL_RIESGO = 0.3;

/** El alumno ya entregó pero el docente todavía no le puso calificación. */
const REVISIONES_SIN_CALIFICAR: EstadoRevision[] = [
  EstadoRevision.ENTREGADA,
  EstadoRevision.REVISADA,
];

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private clases: ClasesService,
  ) {}

  /**
   * Todo lo que el panel del docente necesita en una sola respuesta. Sin esto
   * el navegador dispararía una petición por materia sólo para calcular el
   * porcentaje de asistencia.
   */
  async obtenerPanelDocente(docenteId: number) {
    const periodo = getCurrentAcademicPeriod();
    const materiasDelDocente = materiasDelDocenteWhere(docenteId);

    const [clases, materias, registros, entregas, inscritos, solicitudes] =
      await Promise.all([
        this.clases.obtenerPanelDocente(docenteId),
        this.prisma.materia.findMany({
          where: materiasDelDocente,
          select: {
            id: true,
            nombre: true,
            clave: true,
            unidades: {
              where: { status: EstadoUnidad.ACTIVA },
              orderBy: { orden: 'asc' },
              select: { id: true, nombre: true, orden: true },
            },
            horarios: {
              where: { docenteId, activo: true },
              select: { grupo: { select: { id: true, nombre: true } } },
            },
          },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.asistencia.findMany({
          where: { claseSesion: { docenteId } },
          select: {
            estado: true,
            alumnoId: true,
            claseSesion: { select: { materiaId: true } },
          },
        }),
        this.prisma.entregaTarea.findMany({
          where: {
            tarea: { docenteId },
            estadoRevision: { in: REVISIONES_SIN_CALIFICAR },
          },
          select: { tarea: { select: { materiaId: true } } },
        }),
        this.prisma.inscripcion.groupBy({
          by: ['materiaId'],
          where: {
            estado: 'ACEPTADA',
            periodo,
            materia: materiasDelDocente,
          },
          _count: { _all: true },
        }),
        // Sin filtro de periodo, igual que InscripcionesService.obtenerPendientes,
        // para que el contador coincida con la lista de solicitudes.
        this.prisma.inscripcion.count({
          where: { estado: 'PENDIENTE', materia: materiasDelDocente },
        }),
      ]);

    const asistenciaPorMateria = new Map<
      number,
      { asistencias: number; total: number }
    >();
    const registrosPorAlumno = new Map<
      string,
      { materiaId: number; alumnoId: number; total: number; ausencias: number }
    >();

    for (const registro of registros) {
      const materiaId = registro.claseSesion.materiaId;

      const materia = asistenciaPorMateria.get(materiaId) ?? {
        asistencias: 0,
        total: 0,
      };
      materia.total += 1;
      if (registro.estado === EstadoAsistencia.ASISTENCIA) {
        materia.asistencias += 1;
      }
      asistenciaPorMateria.set(materiaId, materia);

      const clave = `${materiaId}:${registro.alumnoId}`;
      const alumno = registrosPorAlumno.get(clave) ?? {
        materiaId,
        alumnoId: registro.alumnoId,
        total: 0,
        ausencias: 0,
      };
      alumno.total += 1;
      if (
        registro.estado === EstadoAsistencia.FALTA ||
        registro.estado === EstadoAsistencia.RETARDO
      ) {
        alumno.ausencias += 1;
      }
      registrosPorAlumno.set(clave, alumno);
    }

    const riesgoPorMateria = new Map<number, number>();
    const alumnosEnRiesgo = new Set<number>();
    for (const alumno of registrosPorAlumno.values()) {
      if (alumno.total < MIN_REGISTROS_RIESGO) continue;
      if (alumno.ausencias / alumno.total < UMBRAL_RIESGO) continue;
      riesgoPorMateria.set(
        alumno.materiaId,
        (riesgoPorMateria.get(alumno.materiaId) ?? 0) + 1,
      );
      alumnosEnRiesgo.add(alumno.alumnoId);
    }

    const entregasPorMateria = new Map<number, number>();
    for (const entrega of entregas) {
      const materiaId = entrega.tarea.materiaId;
      entregasPorMateria.set(
        materiaId,
        (entregasPorMateria.get(materiaId) ?? 0) + 1,
      );
    }

    const inscritosPorMateria = new Map(
      inscritos.map((item) => [item.materiaId, item._count._all]),
    );

    const resumenMaterias = materias.map((materia) => {
      const asistencia = asistenciaPorMateria.get(materia.id);
      const grupos = [
        ...new Set(
          materia.horarios
            .map((horario) => horario.grupo?.nombre)
            .filter((nombre): nombre is string => Boolean(nombre)),
        ),
      ];

      return {
        id: materia.id,
        nombre: materia.nombre,
        clave: materia.clave,
        grupos,
        alumnos: inscritosPorMateria.get(materia.id) ?? 0,
        unidadActiva: materia.unidades[0] ?? null,
        // null (y no 0) mientras no haya registros: no es lo mismo "nadie
        // asiste" que "todavía no pasas lista".
        porcentajeAsistencia:
          asistencia && asistencia.total > 0
            ? Math.round((asistencia.asistencias / asistencia.total) * 100)
            : null,
        entregasSinCalificar: entregasPorMateria.get(materia.id) ?? 0,
        alumnosEnRiesgo: riesgoPorMateria.get(materia.id) ?? 0,
      };
    });

    return {
      ...clases,
      periodo,
      resumen: {
        materias: resumenMaterias.length,
        clasesHoy: clases.clasesHoy.length,
        // Clases cuyo horario ya pasó y nunca se registró la sesión.
        listasPendientes: clases.clasesHoy.filter(
          (clase) => clase.estado === 'PASADA',
        ).length,
      },
      pendientes: {
        entregasSinCalificar: entregas.length,
        alumnosEnRiesgo: alumnosEnRiesgo.size,
        solicitudes,
      },
      materias: resumenMaterias,
    };
  }
}
