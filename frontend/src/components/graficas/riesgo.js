import { porcentajeAusencias, textoEntregas } from '@/lib/desempeno'
import { resumenAlumno } from '@/lib/resumenFilas'

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

/** Matriz alumno × unidad de una clase, a partir de las filas del reporte. */
export function matrizUnidades(reporte) {
  // Una unidad por iniciar todavía no dice nada del alumno.
  const unidades = (reporte?.unidades ?? []).filter((u) => u.status !== 'PENDIENTE')
  const alumnos = [...new Map((reporte?.rows ?? []).map((r) => [r.alumno.id, r.alumno])).values()]
  const filas = alumnos.map((alumno) => {
    const celdas = unidades.map((u) => celdaRiesgo((reporte.rows ?? []).filter((r) => r.alumno.id === alumno.id && r.unidad?.id === u.id)))
    return {
      alumno,
      celdas,
      reprobadas: celdas.filter((c) => c.estado === 'REPROBADO').length,
      enRiesgo: celdas.filter((c) => conRiesgo(c.estado)).length,
    }
  })
  return {
    columnas: unidades.map((u, i) => ({ ...u, enRiesgo: filas.filter((f) => conRiesgo(f.celdas[i].estado)).length })),
    filas: ordenarFilas(filas),
  }
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

/** Motivo en pocas palabras, para listas dentro del tooltip. */
export const MOTIVO_CORTO = {
  CALIFICACION_BAJA: 'calificación reprobatoria',
  CALIFICACION_LIMITE: 'calificación entre 70 y 79',
  ASISTENCIA: 'faltas y retardos',
  ENTREGAS: 'tareas sin entregar',
}

/** Motivos de una celda en palabras, con las cifras que los explican. */
export function motivosCelda(c) {
  return (c.motivos ?? []).map((m) => {
    if (m === 'ASISTENCIA') return `${porcentajeAusencias(c.asistencia) ?? 0} % de faltas y retardos`
    if (m === 'ENTREGAS') return textoEntregas({ vencidas: c.tareas.vencidas, sinEntregar: c.tareas.vencidasSinEntregar })
    const texto = MOTIVO_CORTO[m] ?? m
    return texto.charAt(0).toUpperCase() + texto.slice(1)
  })
}

/** Lo que un lector de pantalla oye en una celda del mapa. */
export function etiquetaCelda(alumno, columna, c, accion) {
  const estado = ESTADO_CELDA[c.estado].label.toLowerCase()
  if (c.estado === 'NO_INSCRITO') return `${alumno}, ${columna}: no inscrito.`
  if (c.estado === 'CARGANDO' || c.estado === 'NO_DISPONIBLE') return `${alumno}, ${columna}: ${estado}.`
  const promedio = c.promedio == null ? 'sin promedio' : `promedio ${c.promedio}`
  const motivos = motivosCelda(c)
  return `${alumno}, ${columna}: ${estado}, ${promedio}${motivos.length ? `. ${motivos.join('; ')}` : ''}. ${accion}.`
}
