// Estados de registro de una clase. Son evidencia de captura en SICAT: nunca
// demuestran presencia física del docente ni ausencia de los alumnos.
export const ESTADOS_CLASE = {
  PROGRAMADA: {
    label: 'Programada', grupo: 'planned', bloque: 'bg-muted border-border', texto: 'text-muted-foreground',
    explicacion: 'La clase todavía no comienza. La programación no adelanta ningún cumplimiento.',
  },
  REGISTRO_EN_CURSO: {
    label: 'Registro en curso', grupo: 'progress', bloque: 'bg-muted border-border', texto: 'text-primary-ink',
    explicacion: 'El docente tiene una sesión abierta en SICAT. Es evidencia de registro, no de presencia física.',
  },
  LISTA_COMPLETA: {
    label: 'Lista completa', grupo: 'complete', bloque: 'bg-[color-mix(in_oklab,var(--success)_10%,var(--card))] border-success/25', texto: 'text-success-foreground',
    explicacion: 'Todos los alumnos inscritos en la fecha de la clase tienen asistencia capturada.',
  },
  REGISTRO_TARDIO: {
    label: 'Registro tardío', grupo: 'complete', bloque: 'bg-[color-mix(in_oklab,var(--success)_10%,var(--card))] border-success/25', texto: 'text-warning-foreground',
    explicacion: 'La lista está completa, pero se capturó después del horario de la clase.',
  },
  CAPTURA_PARCIAL: {
    label: 'Captura parcial', grupo: 'missing', bloque: 'bg-[color-mix(in_oklab,var(--warning)_15%,var(--card))] border-warning/35', texto: 'text-warning-foreground',
    explicacion: 'Faltan alumnos inscritos por capturar en la lista de esta clase.',
  },
  SIN_CAPTURA: {
    label: 'Sin captura', grupo: 'missing', bloque: 'bg-[color-mix(in_oklab,var(--warning)_15%,var(--card))] border-warning/35', texto: 'text-warning-foreground',
    explicacion: 'Sin evidencia de registro en SICAT. Esto no prueba que la clase no se impartiera; confírmalo en el seguimiento.',
  },
  SUSPENDIDA: {
    label: 'Suspendida', grupo: 'planned', bloque: 'bg-background border-dashed border-border', texto: 'text-muted-foreground',
    explicacion: 'No hubo clase por una suspensión registrada. No cuenta como pendiente.',
  },
  SIN_ALUMNOS: {
    label: 'Sin inscritos', grupo: 'planned', bloque: 'bg-muted border-border', texto: 'text-muted-foreground',
    explicacion: 'No había alumnos con inscripción aceptada en la fecha de la clase; no se espera lista.',
  },
}

export const estadoClase = (estado) => ESTADOS_CLASE[estado] ?? ESTADOS_CLASE.PROGRAMADA

export const ESTADOS_PENDIENTES = new Set(['SIN_CAPTURA', 'CAPTURA_PARCIAL'])

export const esIncidencia = (clase) =>
  (clase.elegible && ESTADOS_PENDIENTES.has(clase.estado)) || clase.estado === 'REGISTRO_TARDIO' || clase.conflictos?.length > 0

export const MOTIVOS_RIESGO = {
  CALIFICACION_BAJA: 'Calificación reprobatoria',
  CALIFICACION_LIMITE: 'Calificación entre 70 y 79',
  ASISTENCIA: 'Faltas y retardos ≥ 30 %',
}

/** El criterio en palabras, generado de los mismos motivos que muestran las listas. */
export const CRITERIO_RIESGO = `${MOTIVOS_RIESGO.CALIFICACION_BAJA} o ${MOTIVOS_RIESGO.CALIFICACION_LIMITE.toLowerCase()} en una unidad, o faltas y retardos de 30 % o más con al menos 3 registros, en alguna materia del periodo.`

export const ESTADO_UNIDAD = {
  PENDIENTE: { label: 'Pendiente', tono: 'muted' },
  ACTIVA: { label: 'En curso', tono: 'accent' },
  FINALIZADA: { label: 'Cerrada', tono: 'neutral' },
}

/** Días que una unidad puede seguir en curso antes de pedir revisar su avance. */
export const DIAS_REVISION_UNIDAD = 28

/** Zona del instituto: los plazos académicos son días civiles de esta zona, no instantes. */
export const ZONA_INSTITUCIONAL = 'America/Mexico_City'

const formatoClave = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_INSTITUCIONAL, year: 'numeric', month: '2-digit', day: '2-digit' })
/** Fecha civil AAAA-MM-DD en la zona del instituto. */
export const claveInstitucional = (instante = new Date()) => formatoClave.format(instante)

// Las fechas de unidad se guardan a medianoche UTC: su día es la parte UTC.
const claveUnidad = (iso) => new Date(iso).toISOString().slice(0, 10)
const fechaUnidad = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000)

/**
 * Señal de una unidad sin cerrar: cierre previsto vencido o demasiados días
 * abierta; null si va bien. El cierre vence cuando su día ya terminó en la
 * zona del instituto: el mismo día de cierre todavía está a tiempo.
 */
export function senalUnidad(u, ahora = new Date()) {
  if (u.status === 'FINALIZADA') return null
  const hoy = claveInstitucional(ahora)
  if (u.fechaFin && claveUnidad(u.fechaFin) < hoy) return `Cierre previsto el ${fechaUnidad(u.fechaFin)} sin registrar`
  if (u.status === 'ACTIVA' && u.fechaInicio) {
    const dias = diasEntre(claveUnidad(u.fechaInicio), hoy)
    if (dias > DIAS_REVISION_UNIDAD) return `Abierta hace ${dias} días; revisar avance`
  }
  return null
}

const fechaCierre = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** Una línea sobre el cierre del curso; null mientras el docente no lo cierra. */
export function textoCierre(cierre) {
  if (!cierre) return null
  const partes = [`Curso cerrado el ${fechaCierre(cierre.cerradoEn)}${cierre.docente ? ` por ${cierre.docente}` : ''}`, `${cierre.acreditados} de ${cierre.total} acreditados`]
  if (cierre.noAcreditados) partes.push(`${cierre.noAcreditados} ${cierre.noAcreditados === 1 ? 'no acreditado' : 'no acreditados'} (NA)`)
  return partes.join(' · ')
}

/** Resultado de un alumno en un curso cerrado: la calificación final o NA. */
export function resultadoCierre(cierre, alumnoId) {
  const r = cierre?.alumnos?.find((a) => a.id === alumnoId)
  if (!r) return null
  if (r.estado === 'ACREDITADO') return { texto: `Final ${r.final} · acreditado`, tono: 'text-success-foreground' }
  if (r.estado === 'NO_ACREDITADO') return { texto: 'NA · no acreditado', tono: 'text-destructive-foreground' }
  return { texto: 'Cierre con resultado pendiente', tono: 'text-muted-foreground' }
}
