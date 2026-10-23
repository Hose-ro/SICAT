import { Injectable } from '@nestjs/common';
import {
  EstadoAsistencia,
  EstadoImportacionHorario,
  EstadoRevision,
  EstadoTarea,
  EstadoUnidad,
  Rol,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClasesService } from '../clases/clases.service';
import { CalificacionesService } from '../calificaciones/calificaciones.service';
import {
  CALIFICACION_APROBATORIA,
  CALIFICACION_SIN_RIESGO,
  MIN_TAREAS_RIESGO,
  UMBRAL_ENTREGAS,
  resumirRiesgoFilas,
} from '../common/desempeno.util';
import {
  materiasActivasDelDocenteWhere,
  materiasDelDocenteWhere,
} from '../common/materia-ownership';
import { gruposDelDocenteWhere } from '../common/grupo-ownership';
import {
  getAcademicPeriodStart,
  getCurrentAcademicPeriod,
} from '../common/periodo.util';
import { MIN_REGISTROS_RIESGO, UMBRAL_RIESGO } from '../common/riesgo.util';

/** Sesiones recientes que se muestran como tendencia de cada alumno en riesgo. */
const SESIONES_TENDENCIA = 4;

/** Reportes de calificaciones que se calculan a la vez. */
const REPORTES_EN_PARALELO = 4;

/** Lo que se usa de cada fila (alumno × unidad) del reporte de calificaciones. */
type FilaReporte = {
  alumno: { id: number; nombre: string; numeroControl: string | null };
  unidad: { id: number; nombre: string };
  calificacionFinal: number | null;
  motivos: string[];
  asistencia?: { registradas: number; faltas: number; retardos: number };
  tareas?: { vencidas: number; vencidasSinEntregar: number };
};
type Clase = {
  materia: { id: number; nombre: string; clave: string | null };
  grupo: { id: number; nombre: string };
};
const claveClase = (materiaId: number, grupoId: number | null) =>
  `${materiaId}:${grupoId ?? '-'}`;

/** Grupos en los que el docente da la materia, según sus horarios activos. */
function gruposDeHorarios(
  horarios: Array<{ grupo: { id: number; nombre: string } | null }>,
): Clase['grupo'][] {
  return [
    ...new Map(
      horarios
        .map((horario) => horario.grupo)
        .filter((grupo): grupo is { id: number; nombre: string } =>
          Boolean(grupo),
        )
        .map((grupo) => [grupo.id, grupo]),
    ).values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function promedio(valores: Array<number | null>) {
  const numeros = valores.filter(
    (valor): valor is number => typeof valor === 'number',
  );
  if (!numeros.length) return null;
  return (
    Math.round((numeros.reduce((a, b) => a + b, 0) / numeros.length) * 10) / 10
  );
}

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
    private calificaciones: CalificacionesService,
  ) {}

  /**
   * Filas (alumno × unidad) de cada clase con el mismo cálculo del semáforo
   * y de la jefatura. Una clase que falla queda en null: no se lee como «sin
   * riesgo».
   */
  private async reportesDeClases(docenteId: number, clases: Clase[]) {
    const actor = { id: docenteId, rol: Rol.DOCENTE };
    const reportes = new Map<string, FilaReporte[] | null>();
    for (let i = 0; i < clases.length; i += REPORTES_EN_PARALELO) {
      await Promise.all(
        clases.slice(i, i + REPORTES_EN_PARALELO).map(async (clase) => {
          const clave = claveClase(clase.materia.id, clase.grupo.id);
          try {
            const reporte = await this.calificaciones.obtenerReporteDocente(
              actor,
              { materiaId: clase.materia.id, grupoId: clase.grupo.id },
            );
            reportes.set(clave, reporte.rows as FilaReporte[]);
          } catch {
            reportes.set(clave, null);
          }
        }),
      );
    }
    return reportes;
  }

  /**
   * Todo lo que el panel del docente necesita en una sola respuesta. Sin esto
   * el navegador dispararía una petición por materia sólo para calcular el
   * porcentaje de asistencia.
   */
  async obtenerPanelDocente(docenteId: number) {
    const periodo = getCurrentAcademicPeriod();
    const materiasDelDocente = materiasDelDocenteWhere(docenteId);
    // Las materias pausadas por el docente no entran a su panel; las
    // solicitudes pendientes sí se cuentan para que nadie quede sin respuesta.
    const materiasActivas = materiasActivasDelDocenteWhere(docenteId);

    const [
      clases,
      materias,
      registros,
      entregas,
      inscritos,
      solicitudes,
      grupos,
      clasesProgramadas,
    ] = await Promise.all([
      this.clases.obtenerPanelDocente(docenteId),
      this.prisma.materia.findMany({
        where: materiasActivas,
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
      // El riesgo se aplica por clase (materia + grupo: el mismo alumno
      // puede ir bien en una y mal en otra) y sólo con lo registrado en el
      // periodo en curso.
      this.prisma.asistencia.findMany({
        where: {
          claseSesion: {
            docenteId,
            fecha: { gte: getAcademicPeriodStart() },
          },
        },
        select: {
          estado: true,
          alumnoId: true,
          claseSesion: { select: { materiaId: true, grupoId: true } },
        },
      }),
      this.prisma.entregaTarea.findMany({
        where: {
          tarea: { docenteId },
          estadoRevision: { in: REVISIONES_SIN_CALIFICAR },
        },
        select: {
          alumnoId: true,
          tarea: { select: { materiaId: true, grupoId: true } },
        },
      }),
      this.prisma.inscripcion.findMany({
        where: {
          estado: 'ACEPTADA',
          periodo,
          materia: materiasActivas,
        },
        select: { materiaId: true, grupoId: true, alumnoId: true },
      }),
      // Sin filtro de periodo, igual que InscripcionesService.obtenerPendientes,
      // para que el contador coincida con la lista de solicitudes.
      this.prisma.inscripcion.count({
        where: { estado: 'PENDIENTE', materia: materiasDelDocente },
      }),
      // Lo que la guía de primeros pasos necesita para saber qué falta.
      this.prisma.grupo.findMany({
        where: gruposDelDocenteWhere(docenteId),
        select: {
          id: true,
          nombre: true,
          _count: { select: { alumnos: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.horarioMateria.count({
        where: { docenteId, activo: true },
      }),
    ]);

    // Una tarea sin grupo es para toda la materia: su entrega cuenta en el
    // grupo en el que está inscrito el alumno.
    const grupoDelAlumno = new Map<string, number | null>();
    const inscritosPorClase = new Map<string, number>();
    for (const inscripcion of inscritos) {
      grupoDelAlumno.set(
        `${inscripcion.materiaId}:${inscripcion.alumnoId}`,
        inscripcion.grupoId,
      );
      const clave = claveClase(inscripcion.materiaId, inscripcion.grupoId);
      inscritosPorClase.set(clave, (inscritosPorClase.get(clave) ?? 0) + 1);
    }

    const asistenciaPorClase = new Map<
      string,
      { asistencias: number; total: number }
    >();

    for (const registro of registros) {
      const clase = claveClase(
        registro.claseSesion.materiaId,
        registro.claseSesion.grupoId,
      );

      const asistencia = asistenciaPorClase.get(clase) ?? {
        asistencias: 0,
        total: 0,
      };
      asistencia.total += 1;
      if (registro.estado === EstadoAsistencia.ASISTENCIA) {
        asistencia.asistencias += 1;
      }
      asistenciaPorClase.set(clase, asistencia);
    }

    const entregasPorClase = new Map<string, number>();
    for (const entrega of entregas) {
      const { materiaId } = entrega.tarea;
      const grupoId =
        entrega.tarea.grupoId ??
        grupoDelAlumno.get(`${materiaId}:${entrega.alumnoId}`) ??
        null;
      const clave = claveClase(materiaId, grupoId);
      entregasPorClase.set(clave, (entregasPorClase.get(clave) ?? 0) + 1);
    }

    // El riesgo sale del mismo cálculo que el semáforo y la jefatura:
    // calificación, asistencia y entregas, por unidad.
    const reportes = await this.reportesDeClases(
      docenteId,
      materias.flatMap((materia) =>
        gruposDeHorarios(materia.horarios).map((grupo) => ({
          materia,
          grupo,
        })),
      ),
    );
    const alumnosEnRiesgo = new Set(
      [...reportes.values()]
        .flatMap((rows) => rows ?? [])
        .filter((row) => row.motivos.length)
        .map((row) => row.alumno.id),
    );

    // Una fila por grupo en el que el docente da la materia; si todavía no
    // tiene horario con grupo, la materia aparece sola.
    const resumenMaterias = materias.flatMap((materia) => {
      const grupos = gruposDeHorarios(materia.horarios);

      const filas: Array<Clase['grupo'] | null> = grupos.length
        ? grupos
        : [null];
      return filas.map((grupo) => {
        const clave = claveClase(materia.id, grupo?.id ?? null);
        const asistencia = asistenciaPorClase.get(clave);
        const rows = reportes.get(clave);
        const riesgo = rows ? resumirRiesgoFilas(rows) : null;
        return {
          id: materia.id,
          nombre: materia.nombre,
          clave: materia.clave,
          grupo,
          alumnos: inscritosPorClase.get(clave) ?? 0,
          unidadActiva: materia.unidades[0] ?? null,
          // null (y no 0) mientras no haya registros: no es lo mismo "nadie
          // asiste" que "todavía no pasas lista".
          porcentajeAsistencia:
            asistencia && asistencia.total > 0
              ? Math.round((asistencia.asistencias / asistencia.total) * 100)
              : null,
          entregasSinCalificar: entregasPorClase.get(clave) ?? 0,
          // null si el reporte de la clase no se pudo calcular.
          alumnosEnRiesgo: riesgo ? riesgo.enRiesgo : null,
          riesgo,
        };
      });
    });

    return {
      ...clases,
      periodo,
      resumen: {
        materias: materias.length,
        clasesHoy: clases.clasesHoy.filter(
          (clase) => clase.estado !== 'SUSPENDIDA',
        ).length,
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
      configuracion: {
        grupos: grupos.map(({ _count, ...grupo }) => ({
          ...grupo,
          alumnos: _count.alumnos,
        })),
        clasesProgramadas,
      },
    };
  }

  /** Clases del docente: cada materia activa en cada grupo de sus horarios. */
  private async clasesDelDocente(docenteId: number): Promise<Clase[]> {
    const materias = await this.prisma.materia.findMany({
      where: materiasActivasDelDocenteWhere(docenteId),
      select: {
        id: true,
        nombre: true,
        clave: true,
        horarios: {
          where: { docenteId, activo: true },
          select: { grupo: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return materias.flatMap(({ horarios, ...materia }) =>
      gruposDeHorarios(horarios).map((grupo) => ({ materia, grupo })),
    );
  }

  /**
   * Alumnos en riesgo de cada clase del docente con el criterio único
   * (calificación, asistencia y entregas, por unidad), con lo necesario para
   * actuar: qué unidad y por qué, cómo van las últimas sesiones y si ya se
   * les avisó (un aviso individual queda registrado).
   */
  async obtenerRiesgoDocente(
    docenteId: number,
    filtros: { materiaId?: number; grupoId?: number } = {},
  ) {
    const desde = getAcademicPeriodStart();
    const criterio = {
      minRegistros: MIN_REGISTROS_RIESGO,
      porcentaje: Math.round(UMBRAL_RIESGO * 100),
      aprobatoria: CALIFICACION_APROBATORIA,
      sinRiesgo: CALIFICACION_SIN_RIESGO,
      minTareas: MIN_TAREAS_RIESGO,
      porcentajeEntregas: Math.round(UMBRAL_ENTREGAS * 100),
    };
    const clases = (await this.clasesDelDocente(docenteId)).filter(
      (clase) =>
        (!filtros.materiaId || clase.materia.id === filtros.materiaId) &&
        (!filtros.grupoId || clase.grupo.id === filtros.grupoId),
    );
    const reportes = await this.reportesDeClases(docenteId, clases);
    const clasesSinDatos = clases
      .filter(
        (clase) =>
          reportes.get(claveClase(clase.materia.id, clase.grupo.id)) === null,
      )
      .map(({ materia, grupo }) => ({
        materia: { id: materia.id, nombre: materia.nombre },
        grupo,
      }));

    const filas = clases.flatMap((clase) => {
      const rows =
        reportes.get(claveClase(clase.materia.id, clase.grupo.id)) ?? [];
      const porAlumno = new Map<number, FilaReporte[]>();
      for (const row of rows) {
        porAlumno.set(row.alumno.id, [
          ...(porAlumno.get(row.alumno.id) ?? []),
          row,
        ]);
      }
      return [...porAlumno.values()]
        .filter((propias) => propias.some((row) => row.motivos.length))
        .map((propias) => {
          const suma = (valor: (row: FilaReporte) => number | undefined) =>
            propias.reduce((total, row) => total + (valor(row) ?? 0), 0);
          const registros = suma((row) => row.asistencia?.registradas);
          const faltas = suma((row) => row.asistencia?.faltas);
          const retardos = suma((row) => row.asistencia?.retardos);
          const { id, nombre, numeroControl } = propias[0].alumno;
          return {
            alumno: { id, nombre, numeroControl },
            materia: { id: clase.materia.id, nombre: clase.materia.nombre },
            grupo: clase.grupo,
            motivos: [...new Set(propias.flatMap((row) => row.motivos))],
            unidades: propias
              .filter((row) => row.motivos.length)
              .map((row) => ({
                id: row.unidad.id,
                nombre: row.unidad.nombre,
                motivos: row.motivos,
                calificacion: row.calificacionFinal,
              })),
            calificacion: promedio(propias.map((row) => row.calificacionFinal)),
            registros,
            faltas,
            retardos,
            porcentajeAusencias: registros
              ? Math.round(((faltas + retardos) / registros) * 100)
              : null,
            tareasVencidas: suma((row) => row.tareas?.vencidas),
            tareasSinEntregar: suma((row) => row.tareas?.vencidasSinEntregar),
          };
        });
    });

    if (!filas.length) {
      return { desde, criterio, clasesSinDatos, alumnos: [] };
    }

    const alumnoIds = [...new Set(filas.map((fila) => fila.alumno.id))];
    const materiaIds = [...new Set(filas.map((fila) => fila.materia.id))];
    const [registros, avisos] = await Promise.all([
      this.prisma.asistencia.findMany({
        where: {
          alumnoId: { in: alumnoIds },
          claseSesion: {
            docenteId,
            materiaId: { in: materiaIds },
            fecha: { gte: desde },
          },
        },
        select: {
          estado: true,
          alumnoId: true,
          claseSesion: { select: { materiaId: true, grupoId: true } },
        },
        orderBy: { claseSesion: { fecha: 'asc' } },
      }),
      this.prisma.aviso.findMany({
        where: { alumnoId: { in: alumnoIds }, materiaId: { in: materiaIds } },
        select: {
          id: true,
          titulo: true,
          createdAt: true,
          materiaId: true,
          grupoId: true,
          alumnoId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const estados = new Map<string, EstadoAsistencia[]>();
    for (const registro of registros) {
      const clave = `${claveClase(registro.claseSesion.materiaId, registro.claseSesion.grupoId)}:${registro.alumnoId}`;
      estados.set(clave, [...(estados.get(clave) ?? []), registro.estado]);
    }

    const alumnos = filas.map((fila) => {
      const ultimoAviso =
        avisos.find(
          (aviso) =>
            aviso.alumnoId === fila.alumno.id &&
            aviso.materiaId === fila.materia.id &&
            aviso.grupoId === fila.grupo.id,
        ) ?? null;
      return {
        ...fila,
        tendencia: (
          estados.get(
            `${claveClase(fila.materia.id, fila.grupo.id)}:${fila.alumno.id}`,
          ) ?? []
        ).slice(-SESIONES_TENDENCIA),
        ultimoAviso: ultimoAviso
          ? {
              id: ultimoAviso.id,
              titulo: ultimoAviso.titulo,
              createdAt: ultimoAviso.createdAt,
            }
          : null,
      };
    });

    // Primero quien ya reprueba, luego quien suma más motivos.
    const reprueba = (fila: (typeof alumnos)[number]) =>
      fila.motivos.includes('CALIFICACION_BAJA') ? 1 : 0;
    alumnos.sort(
      (a, b) =>
        reprueba(b) - reprueba(a) ||
        b.motivos.length - a.motivos.length ||
        (b.porcentajeAusencias ?? 0) - (a.porcentajeAusencias ?? 0) ||
        a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'),
    );
    return { desde, criterio, clasesSinDatos, alumnos };
  }

  /**
   * Panel del admin. Mismo criterio que el del docente: una sola respuesta con
   * lo accionable arriba. Lo que el admin resuelve son colas (registros por
   * aprobar, horarios por revisar) y huecos de configuración (materias sin
   * docente o sin horario), no promedios.
   */
  async obtenerPanelAdmin() {
    const periodo = getCurrentAcademicPeriod();
    const inicioDeHoy = new Date();
    inicioDeHoy.setHours(0, 0, 0, 0);
    const inicioDeManana = new Date(inicioDeHoy);
    inicioDeManana.setDate(inicioDeManana.getDate() + 1);

    const [
      registrosPorAprobar,
      horariosPorRevisar,
      inscripcionesPendientes,
      carreras,
      materias,
      grupos,
      docentes,
      alumnos,
      clasesHoy,
      asistenciasHoy,
      ultimaClase,
      tareasPublicadas,
      materiasIncompletas,
    ] = await Promise.all([
      // Mismo criterio que la lista de Usuarios: alumno activo cuyo registro
      // todavía no aprueba nadie.
      this.prisma.usuario.count({
        where: { rol: Rol.ALUMNO, activo: true, registroAprobado: false },
      }),
      this.prisma.importacionHorario.count({
        where: { estado: EstadoImportacionHorario.PENDIENTE_REVISION },
      }),
      this.prisma.inscripcion.count({ where: { estado: 'PENDIENTE' } }),
      this.prisma.carrera.count(),
      this.prisma.materia.count(),
      this.prisma.grupo.count({ where: { activo: true, periodo } }),
      this.prisma.usuario.count({ where: { rol: Rol.DOCENTE, activo: true } }),
      this.prisma.usuario.count({
        where: { rol: Rol.ALUMNO, activo: true, registroAprobado: true },
      }),
      this.prisma.claseSesion.count({
        where: { fecha: { gte: inicioDeHoy, lt: inicioDeManana } },
      }),
      this.prisma.asistencia.count({
        where: { createdAt: { gte: inicioDeHoy, lt: inicioDeManana } },
      }),
      // Para poder decir "hace 3 días" en vez de un "Hoy" escrito a mano.
      this.prisma.claseSesion.findFirst({
        orderBy: { fecha: 'desc' },
        select: { fecha: true },
      }),
      this.prisma.tarea.count({
        where: { activa: true, estado: EstadoTarea.PUBLICADA },
      }),
      // Una materia sin docente o sin horario activo no se puede impartir:
      // es trabajo pendiente del admin, no una métrica.
      this.prisma.materia.findMany({
        where: {
          OR: [{ docenteId: null }, { horarios: { none: { activo: true } } }],
        },
        select: {
          id: true,
          nombre: true,
          clave: true,
          docenteId: true,
          carrera: { select: { nombre: true } },
          _count: { select: { horarios: { where: { activo: true } } } },
        },
        orderBy: { nombre: 'asc' },
        take: 6,
      }),
    ]);

    const totalMateriasIncompletas = await this.prisma.materia.count({
      where: {
        OR: [{ docenteId: null }, { horarios: { none: { activo: true } } }],
      },
    });

    return {
      periodo,
      pendientes: {
        registrosPorAprobar,
        horariosPorRevisar,
        inscripcionesPendientes,
      },
      catalogo: { carreras, materias, grupos, docentes, alumnos },
      actividad: {
        clasesHoy,
        asistenciasHoy,
        tareasPublicadas,
        // null y no una fecha inventada: puede que nunca se haya pasado lista.
        ultimoRegistro: ultimaClase?.fecha ?? null,
      },
      materiasIncompletas: materiasIncompletas.map((materia) => ({
        id: materia.id,
        nombre: materia.nombre,
        clave: materia.clave,
        carrera: materia.carrera?.nombre ?? null,
        sinDocente: materia.docenteId === null,
        sinHorario: materia._count.horarios === 0,
      })),
      totalMateriasIncompletas,
    };
  }
}
