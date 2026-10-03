import { Injectable } from '@nestjs/common';
import {
  EstadoAsistencia,
  EstadoImportacionHorario,
  EstadoRevision,
  EstadoTarea,
  EstadoUnidad,
  Rol,
  TipoEntrega,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClasesService } from '../clases/clases.service';
import {
  materiasActivasDelDocenteWhere,
  materiasDelDocenteWhere,
} from '../common/materia-ownership';
import {
  getAcademicPeriodStart,
  getCurrentAcademicPeriod,
} from '../common/periodo.util';
import {
  esAusencia,
  estaEnRiesgo,
  MIN_REGISTROS_RIESGO,
  UMBRAL_RIESGO,
} from '../common/riesgo.util';

/** Sesiones recientes que se muestran como tendencia de cada alumno en riesgo. */
const SESIONES_TENDENCIA = 4;

/** Tareas cuyo plazo ya pasó: si no hay entrega, ya no llegó a tiempo. */
const ESTADOS_TAREA_CON_PLAZO: EstadoTarea[] = [
  EstadoTarea.PUBLICADA,
  EstadoTarea.VENCIDA,
  EstadoTarea.CERRADA,
];

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
    // Las materias pausadas por el docente no entran a su panel; las
    // solicitudes pendientes sí se cuentan para que nadie quede sin respuesta.
    const materiasActivas = materiasActivasDelDocenteWhere(docenteId);

    const [clases, materias, registros, entregas, inscritos, solicitudes] =
      await Promise.all([
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
      ]);

    /** Cada (materia, grupo) es una clase distinta en el panel. */
    const claveClase = (materiaId: number, grupoId: number | null) =>
      `${materiaId}:${grupoId ?? '-'}`;

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
    const registrosPorAlumno = new Map<
      string,
      { clase: string; alumnoId: number; total: number; ausencias: number }
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

      const clave = `${clase}:${registro.alumnoId}`;
      const alumno = registrosPorAlumno.get(clave) ?? {
        clase,
        alumnoId: registro.alumnoId,
        total: 0,
        ausencias: 0,
      };
      alumno.total += 1;
      if (esAusencia(registro.estado)) alumno.ausencias += 1;
      registrosPorAlumno.set(clave, alumno);
    }

    const riesgoPorClase = new Map<string, number>();
    const alumnosEnRiesgo = new Set<number>();
    for (const alumno of registrosPorAlumno.values()) {
      if (!estaEnRiesgo(alumno.total, alumno.ausencias)) continue;
      riesgoPorClase.set(
        alumno.clase,
        (riesgoPorClase.get(alumno.clase) ?? 0) + 1,
      );
      alumnosEnRiesgo.add(alumno.alumnoId);
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

    // Una fila por grupo en el que el docente da la materia; si todavía no
    // tiene horario con grupo, la materia aparece sola.
    const resumenMaterias = materias.flatMap((materia) => {
      const grupos = [
        ...new Map(
          materia.horarios
            .map((horario) => horario.grupo)
            .filter((grupo): grupo is { id: number; nombre: string } =>
              Boolean(grupo),
            )
            .map((grupo) => [grupo.id, grupo]),
        ).values(),
      ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      return (grupos.length ? grupos : [null]).map((grupo) => {
        const clave = claveClase(materia.id, grupo?.id ?? null);
        const asistencia = asistenciaPorClase.get(clave);
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
          alumnosEnRiesgo: riesgoPorClase.get(clave) ?? 0,
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
    };
  }

  /**
   * Alumnos en riesgo de cada clase del docente, con lo necesario para
   * actuar: cuánto faltan, cómo van las últimas sesiones, qué tareas vencidas
   * no entregaron y si ya se les avisó (un aviso individual queda registrado).
   */
  async obtenerRiesgoDocente(
    docenteId: number,
    filtros: { materiaId?: number; grupoId?: number } = {},
  ) {
    const desde = getAcademicPeriodStart();
    const registros = await this.prisma.asistencia.findMany({
      where: {
        claseSesion: {
          docenteId,
          fecha: { gte: desde },
          ...(filtros.materiaId ? { materiaId: filtros.materiaId } : {}),
          ...(filtros.grupoId ? { grupoId: filtros.grupoId } : {}),
        },
      },
      select: {
        estado: true,
        alumno: { select: { id: true, nombre: true, numeroControl: true } },
        claseSesion: {
          select: { materiaId: true, grupoId: true, fecha: true },
        },
      },
      orderBy: { claseSesion: { fecha: 'asc' } },
    });

    type Fila = {
      alumno: { id: number; nombre: string; numeroControl: string | null };
      materiaId: number;
      grupoId: number | null;
      registros: number;
      faltas: number;
      retardos: number;
      estados: EstadoAsistencia[];
    };
    const filas = new Map<string, Fila>();
    for (const registro of registros) {
      const { materiaId, grupoId } = registro.claseSesion;
      const clave = `${materiaId}:${grupoId ?? '-'}:${registro.alumno.id}`;
      const fila = filas.get(clave) ?? {
        alumno: registro.alumno,
        materiaId,
        grupoId,
        registros: 0,
        faltas: 0,
        retardos: 0,
        estados: [],
      };
      fila.registros += 1;
      if (registro.estado === EstadoAsistencia.FALTA) fila.faltas += 1;
      if (registro.estado === EstadoAsistencia.RETARDO) fila.retardos += 1;
      fila.estados.push(registro.estado);
      filas.set(clave, fila);
    }
    const enRiesgo = [...filas.values()].filter((fila) =>
      estaEnRiesgo(fila.registros, fila.faltas + fila.retardos),
    );

    const criterio = {
      minRegistros: MIN_REGISTROS_RIESGO,
      porcentaje: Math.round(UMBRAL_RIESGO * 100),
    };
    if (!enRiesgo.length) {
      return { desde, criterio, alumnos: [] };
    }

    const materiaIds = [...new Set(enRiesgo.map((fila) => fila.materiaId))];
    const alumnoIds = [...new Set(enRiesgo.map((fila) => fila.alumno.id))];
    const grupoIds = [
      ...new Set(
        enRiesgo
          .map((fila) => fila.grupoId)
          .filter((id): id is number => id != null),
      ),
    ];
    const [materias, grupos, tareas, avisos] = await Promise.all([
      this.prisma.materia.findMany({
        where: { id: { in: materiaIds } },
        select: { id: true, nombre: true },
      }),
      this.prisma.grupo.findMany({
        where: { id: { in: grupoIds } },
        select: { id: true, nombre: true },
      }),
      this.prisma.tarea.findMany({
        where: {
          materiaId: { in: materiaIds },
          estado: { in: ESTADOS_TAREA_CON_PLAZO },
          tieneFechaLimite: true,
          fechaLimite: { gte: desde, lt: new Date() },
        },
        select: {
          id: true,
          materiaId: true,
          grupoId: true,
          tipoEntrega: true,
          entregas: {
            where: { alumnoId: { in: alumnoIds } },
            select: { alumnoId: true, estadoRevision: true },
          },
        },
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
    const nombreMateria = new Map(materias.map((m) => [m.id, m.nombre]));
    const nombreGrupo = new Map(grupos.map((g) => [g.id, g.nombre]));

    const alumnos = enRiesgo.map((fila) => {
      const tareasClase = tareas.filter(
        (tarea) =>
          tarea.materiaId === fila.materiaId &&
          (tarea.grupoId == null || tarea.grupoId === fila.grupoId),
      );
      const ultimoAviso =
        avisos.find(
          (aviso) =>
            aviso.alumnoId === fila.alumno.id &&
            aviso.materiaId === fila.materiaId &&
            aviso.grupoId === fila.grupoId,
        ) ?? null;
      return {
        alumno: fila.alumno,
        materia: {
          id: fila.materiaId,
          nombre: nombreMateria.get(fila.materiaId),
        },
        grupo: fila.grupoId
          ? { id: fila.grupoId, nombre: nombreGrupo.get(fila.grupoId) }
          : null,
        registros: fila.registros,
        faltas: fila.faltas,
        retardos: fila.retardos,
        porcentajeAusencias: Math.round(
          ((fila.faltas + fila.retardos) / fila.registros) * 100,
        ),
        tendencia: fila.estados.slice(-SESIONES_TENDENCIA),
        tareasVencidas: tareasClase.length,
        tareasSinEntregar: tareasClase.filter((tarea) => {
          const entrega = tarea.entregas.find(
            (item) => item.alumnoId === fila.alumno.id,
          );
          // En clase no hay entrega que esperar: sólo cuenta "no presentó".
          if (tarea.tipoEntrega === TipoEntrega.PRESENCIAL) {
            return entrega?.estadoRevision === EstadoRevision.NO_ENTREGADA;
          }
          return (
            !entrega || entrega.estadoRevision === EstadoRevision.NO_ENTREGADA
          );
        }).length,
        ultimoAviso: ultimoAviso
          ? {
              id: ultimoAviso.id,
              titulo: ultimoAviso.titulo,
              createdAt: ultimoAviso.createdAt,
            }
          : null,
      };
    });

    alumnos.sort(
      (a, b) =>
        b.porcentajeAusencias - a.porcentajeAusencias ||
        a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'),
    );
    return { desde, criterio, alumnos };
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
