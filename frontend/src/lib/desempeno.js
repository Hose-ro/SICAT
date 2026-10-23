// Semáforo de la calificación de un alumno en una unidad: aprobado desde 70,
// reprobado debajo, sin estado intermedio. Lo calcula el servidor
// (common/desempeno.util.ts); aquí sólo se nombra y se ordena.
export const DESEMPENO = {
  REPROBADO: { label: 'Reprobado', plural: 'Reprobados', tono: 'destructive', punto: 'bg-destructive', cifra: 'text-destructive-foreground', fondo: 'bg-destructive/12' },
  SIN_CALIFICAR: { label: 'Sin calificar', plural: 'Sin calificar', tono: 'muted', punto: 'bg-muted-foreground', cifra: 'text-muted-foreground' },
  APROBADO: { label: 'Aprobado', plural: 'Aprobados', tono: 'success', punto: 'bg-success', cifra: 'text-success-foreground', fondo: 'bg-success/12' },
}

// Lo que pide atención primero.
export const ORDEN_DESEMPENO = ['REPROBADO', 'SIN_CALIFICAR', 'APROBADO']

export const infoDesempeno = (estado) => DESEMPENO[estado] ?? DESEMPENO.SIN_CALIFICAR

/**
 * Un servidor anterior todavía manda EN_RIESGO (70 a 79, o faltas y
 * entregas): con calificación ya aprueba, sin ella sigue sin calificar.
 */
export function normalizarDesempeno(estado, calificacion) {
  if (estado !== 'EN_RIESGO') return estado
  return calificacion == null ? 'SIN_CALIFICAR' : 'APROBADO'
}

export function porcentajeAusencias(asistencia) {
  if (!asistencia?.registradas) return null
  return Math.round(((asistencia.faltas + asistencia.retardos) / asistencia.registradas) * 100)
}

/** Tareas vencidas sin entregar, en palabras. */
export function textoEntregas(entregas) {
  if (!entregas?.vencidas) return 'Tareas vencidas sin entregar'
  return `${entregas.sinEntregar} de ${entregas.vencidas} tareas vencidas sin entregar`
}

/** Por qué está en ese color, en palabras. */
export function textoMotivos(item, umbrales = { aprobatoria: 70 }) {
  return (item.motivos ?? []).map((motivo) => {
    if (motivo === 'CALIFICACION_BAJA') return `Promedio menor a ${umbrales.aprobatoria}`
    if (motivo === 'ASISTENCIA') return `${porcentajeAusencias(item.asistencia) ?? 0} % de faltas y retardos`
    if (motivo === 'ENTREGAS') return textoEntregas(item.entregas)
    return motivo
  })
}

export function ordenarPorDesempeno(alumnos) {
  return [...alumnos].sort(
    (a, b) =>
      ORDEN_DESEMPENO.indexOf(a.desempeno) - ORDEN_DESEMPENO.indexOf(b.desempeno) ||
      (a.calificacion ?? 101) - (b.calificacion ?? 101) ||
      a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'),
  )
}

/** Valor corto de una celda: entero si se puede, con un decimal si no. */
export function valorCorto(valor) {
  if (typeof valor !== 'number') return '—'
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1)
}
