import { resumenAlumno } from '../supervision/useReportes'

/**
 * Estado de una celda alumno × materia. El semáforo lo calcula el servidor
 * por unidad; aquí se toma la peor unidad. «En riesgo» es lo mismo que
 * cuenta el resumen de la jefatura: alguna unidad con motivos.
 */
export const ESTADO_CELDA = {
  REPROBADO: { label: 'Reprobado', clase: 'viz-riesgo--reprobado' },
  EN_RIESGO: { label: 'En riesgo', clase: 'viz-riesgo--alerta' },
  APROBADO: { label: 'Sin señales', clase: 'viz-riesgo--ok' },
  SIN_CALIFICAR: { label: 'Sin calificar', clase: 'viz-riesgo--sin' },
  NO_INSCRITO: { label: 'No inscrito', clase: 'viz-cell--vacia' },
  NO_DISPONIBLE: { label: 'No disponible', clase: 'viz-riesgo--sin' },
  CARGANDO: { label: 'Cargando', clase: 'viz-riesgo--sin' },
}

export const conRiesgo = (estado) => estado === 'REPROBADO' || estado === 'EN_RIESGO'

/** Una materia del alumno, a partir de sus filas (una por unidad) en el reporte. */
export function celdaRiesgo(rows, reporte = { data: true }) {
  if (reporte.error) return { estado: 'NO_DISPONIBLE', rows: [] }
  if (!reporte.data) return { estado: 'CARGANDO', rows: [] }
  if (!rows.length) return { estado: 'NO_INSCRITO', rows }
  const r = resumenAlumno(rows)
  // Reprobar (abierta o cerrada) siempre trae CALIFICACION_BAJA entre los motivos.
  const estado = rows.some((row) => row.motivos?.includes('CALIFICACION_BAJA'))
    ? 'REPROBADO'
    : rows.some((row) => row.motivos?.length)
      ? 'EN_RIESGO'
      : rows.some((row) => row.calificacionFinal != null)
        ? 'APROBADO'
        : 'SIN_CALIFICAR'
  return {
    estado,
    rows,
    promedio: r.promedio,
    tipo: r.tipo,
    asistencia: r.asistencia,
    tareas: r.tareas,
    motivos: r.motivos,
    // Qué unidad explica cada señal, para el tooltip y el lector de pantalla.
    unidades: rows.filter((row) => row.motivos?.length).map((row) => ({ nombre: row.unidad?.nombre ?? 'Unidad', motivos: row.motivos, calificacion: row.calificacionFinal })),
  }
}

/**
 * Matriz del grupo: una fila por alumno y una columna por materia. Las filas
 * con más materias reprobadas y luego en riesgo van primero.
 */
export function matrizRiesgo(alumnos, ofertas, reportes, grupoId) {
  const columnas = ofertas.map((o) => {
    const clave = `${o.materia.id}:${grupoId}`
    return { id: o.id, materia: o.materia, clave, reporte: reportes[clave] ?? { cargando: true } }
  })
  const filas = alumnos.map((alumno) => {
    const celdas = columnas.map((c) => celdaRiesgo((c.reporte.data?.rows ?? []).filter((r) => r.alumno.id === alumno.id), c.reporte))
    return {
      alumno,
      celdas,
      reprobadas: celdas.filter((c) => c.estado === 'REPROBADO').length,
      enRiesgo: celdas.filter((c) => conRiesgo(c.estado)).length,
    }
  })
  return {
    columnas: columnas.map((c, i) => ({ ...c, enRiesgo: filas.filter((f) => conRiesgo(f.celdas[i].estado)).length })),
    filas: ordenarFilas(filas),
  }
}

export function ordenarFilas(filas) {
  return [...filas].sort((a, b) => b.reprobadas - a.reprobadas || b.enRiesgo - a.enRiesgo || a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'))
}

/**
 * Grupos comparados por la proporción de alumnos en riesgo. Devuelve null si
 * el servidor todavía no manda los conteos por grupo.
 */
export function comparativoGrupos(grupos) {
  if (!grupos.some((g) => g.alumnosEvaluados != null)) return null
  return grupos
    .filter((g) => g.alumnosEvaluados > 0)
    .map((g) => {
      const porcentaje = (n) => Math.round((n / g.alumnosEvaluados) * 100)
      const motivos = g.riesgoPorMotivo ?? { reprobando: 0, calificacion: 0, asistencia: 0, entregas: 0 }
      return {
        ...g,
        motivos,
        porcentaje: porcentaje(g.alumnosRiesgo),
        // Las dos partes de la barra suman el total: rojo para quien ya reprueba, ámbar para el resto.
        reprobando: porcentaje(motivos.reprobando),
      }
    })
    .sort((a, b) => b.porcentaje - a.porcentaje || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Motivos de un grupo en prosa: «asistencia 4, calificación 6, entregas 3». */
export function textoMotivosGrupo(motivos) {
  const partes = [
    motivos.calificacion && `calificación ${motivos.calificacion}`,
    motivos.asistencia && `asistencia ${motivos.asistencia}`,
    motivos.entregas && `entregas ${motivos.entregas}`,
  ].filter(Boolean)
  if (!partes.length) return ''
  const texto = partes.join(', ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
