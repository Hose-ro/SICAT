// Semáforo de un alumno en una unidad. Lo calcula el servidor
// (common/desempeno.util.ts); aquí sólo se nombra y se ordena.
export const DESEMPENO = {
  REPROBADO: { label: 'Reprobado', plural: 'Reprobados', tono: 'destructive', punto: 'bg-destructive', cifra: 'text-destructive-foreground' },
  EN_RIESGO: { label: 'En riesgo', plural: 'En riesgo', tono: 'warning', punto: 'bg-warning', cifra: 'text-warning-foreground' },
  SIN_CALIFICAR: { label: 'Sin calificar', plural: 'Sin calificar', tono: 'muted', punto: 'bg-muted-foreground', cifra: 'text-muted-foreground' },
  APROBADO: { label: 'Aprobado', plural: 'Aprobados', tono: 'success', punto: 'bg-success', cifra: 'text-success-foreground' },
}

// Lo que pide atención primero.
export const ORDEN_DESEMPENO = ['REPROBADO', 'EN_RIESGO', 'SIN_CALIFICAR', 'APROBADO']

export const infoDesempeno = (estado) => DESEMPENO[estado] ?? DESEMPENO.SIN_CALIFICAR

export function porcentajeAusencias(asistencia) {
  if (!asistencia?.registradas) return null
  return Math.round(((asistencia.faltas + asistencia.retardos) / asistencia.registradas) * 100)
}

/** Por qué está en ese color, en palabras. */
export function textoMotivos(item, umbrales = { aprobatoria: 70, sinRiesgo: 80 }) {
  return (item.motivos ?? []).map((motivo) => {
    if (motivo === 'CALIFICACION_BAJA') return `Promedio menor a ${umbrales.aprobatoria}`
    if (motivo === 'CALIFICACION_LIMITE') return `Promedio menor a ${umbrales.sinRiesgo}`
    if (motivo === 'ASISTENCIA') return `${porcentajeAusencias(item.asistencia) ?? 0} % de faltas y retardos`
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
