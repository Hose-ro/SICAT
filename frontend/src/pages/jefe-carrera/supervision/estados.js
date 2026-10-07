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

export const ESTADO_UNIDAD = {
  PENDIENTE: { label: 'Pendiente', tono: 'muted' },
  ACTIVA: { label: 'En curso', tono: 'accent' },
  FINALIZADA: { label: 'Cerrada', tono: 'neutral' },
}
