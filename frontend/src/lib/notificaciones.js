import {
  AlarmClock, Bell, BookOpen, CalendarCheck, CalendarClock, CalendarRange, CalendarX, ChartColumn,
  CircleCheck, CircleX, ClipboardCheck, Clock, Inbox, ListChecks, MessageSquareText, StickyNote,
  Sun, Upload, UserRound,
} from 'lucide-react'

// `tone` maps the event to the status tokens (DESIGN.md: status is semantic):
// success = accepted/graded, warning = pending/late/soon, destructive = rejected.
export const NOTIFICATION_META = {
  INSCRIPCION_NUEVA: { icon: StickyNote, label: 'Solicitud', tone: 'neutral' },
  INSCRIPCION_ACEPTADA: { icon: CircleCheck, label: 'Solicitud aceptada', tone: 'success' },
  INSCRIPCION_RECHAZADA: { icon: CircleX, label: 'Solicitud rechazada', tone: 'destructive' },
  SOLICITUD_MATERIA: { icon: StickyNote, label: 'Solicitud', tone: 'neutral' },
  SOLICITUD_ACEPTADA: { icon: CircleCheck, label: 'Solicitud aceptada', tone: 'success' },
  SOLICITUD_RECHAZADA: { icon: CircleX, label: 'Solicitud rechazada', tone: 'destructive' },
  CLASE_POR_INICIAR: { icon: AlarmClock, label: 'Clase por iniciar', tone: 'warning' },
  CLASE_INICIADA: { icon: Sun, label: 'Clase iniciada', tone: 'neutral' },
  CLASE_FINALIZADA: { icon: CalendarCheck, label: 'Clase finalizada', tone: 'neutral' },
  TAREA_NUEVA: { icon: BookOpen, label: 'Tarea nueva', tone: 'neutral' },
  NUEVA_TAREA: { icon: BookOpen, label: 'Tarea nueva', tone: 'neutral' },
  TAREA_REVISADA: { icon: ListChecks, label: 'Revisión', tone: 'neutral' },
  TAREA_CALIFICADA: { icon: ClipboardCheck, label: 'Calificación', tone: 'success' },
  CALIFICACION_DISPONIBLE: { icon: ClipboardCheck, label: 'Calificación', tone: 'success' },
  OBSERVACION_DOCENTE: { icon: MessageSquareText, label: 'Observación', tone: 'neutral' },
  ENTREGA_RECIBIDA: { icon: Inbox, label: 'Entrega', tone: 'neutral' },
  ENTREGA_TAREA: { icon: Upload, label: 'Entrega', tone: 'neutral' },
  ENTREGA_TARDIA: { icon: Clock, label: 'Entrega tardía', tone: 'warning' },
  ENTREGA_TARDIA_DOCENTE: { icon: Clock, label: 'Entrega tardía', tone: 'warning' },
  ENTREGA_CORREGIDA: { icon: CircleCheck, label: 'Corrección', tone: 'success' },
  ENTREGA_INCORRECTA: { icon: CircleX, label: 'Entrega incorrecta', tone: 'destructive' },
  RECORDATORIO_FECHA_LIMITE: { icon: AlarmClock, label: 'Recordatorio', tone: 'warning' },
  TAREAS_PENDIENTES_REVISION: { icon: ListChecks, label: 'Pendientes', tone: 'warning' },
  ASISTENCIA_FUERA_HORARIO: { icon: CalendarX, label: 'Asistencia', tone: 'warning' },
  NUEVO_USUARIO: { icon: UserRound, label: 'Usuario', tone: 'neutral' },
  MATERIA_CREADA: { icon: BookOpen, label: 'Materia', tone: 'neutral' },
  REPORTE_DISPONIBLE: { icon: ChartColumn, label: 'Reporte', tone: 'neutral' },
  ALERTA_ADMIN: { icon: Bell, label: 'Alerta', tone: 'warning' },
  HORARIO_IMPORTADO: { icon: CalendarRange, label: 'Horario recibido', tone: 'neutral' },
  HORARIO_APROBADO: { icon: CalendarCheck, label: 'Horario aprobado', tone: 'success' },
  HORARIO_RECHAZADO: { icon: CalendarX, label: 'Horario rechazado', tone: 'destructive' },
}

export const NOTIFICATION_TONE_CLASS = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success-foreground',
  warning: 'bg-warning/15 text-warning-foreground',
  destructive: 'bg-destructive/10 text-destructive-foreground',
}

export function getNotificationMeta(tipo) {
  return NOTIFICATION_META[tipo] || { icon: CalendarClock, label: 'Aviso', tone: 'neutral' }
}

export function formatNotificationTime(fecha, ahora = Date.now()) {
  if (!fecha) return ''
  const date = new Date(fecha)
  const diff = ahora - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days} d`
  const opciones = { day: 'numeric', month: 'short' }
  if (date.getFullYear() !== new Date(ahora).getFullYear()) opciones.year = 'numeric'
  return date.toLocaleDateString('es-MX', opciones)
}

export function formatNotificationDateTime(fecha) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
}

export function resolveNotificationRoute(notificacion, rol) {
  const { referenciaId, referenciaTipo } = notificacion || {}

  if (rol === 'JEFE_CARRERA') {
    if (['Asistencias', 'ClaseSesion', 'HorarioMateria'].includes(referenciaTipo)) {
      return '/jefe-carrera/clases'
    }
    if (['Materia', 'Unidad'].includes(referenciaTipo)) {
      return '/jefe-carrera/seguimiento'
    }
    if (referenciaTipo === 'Usuario') return '/jefe-carrera/docentes'
    if (referenciaTipo?.startsWith('Reporte')) return '/jefe-carrera/reportes'
    return '/jefe-carrera/alertas'
  }

  switch (referenciaTipo) {
    case 'Tarea':
      if (!referenciaId) return '/tareas'
      return rol === 'ALUMNO'
        ? `/alumno/tareas/${referenciaId}`
        : `/docente/tareas/${referenciaId}`
    case 'Solicitud':
    case 'Inscripcion':
      return '/materias'
    case 'Unidad':
      return '/materias'
    case 'Materia':
      if (!referenciaId) return '/materias'
      return rol === 'ALUMNO'
        ? `/alumno/materias/${referenciaId}`
        : `/materias/${referenciaId}`
    case 'Asistencias':
    case 'ClaseSesion':
    case 'HorarioMateria':
      return '/asistencias'
    case 'ImportacionHorario':
      return rol === 'ADMIN' ? '/admin/horarios-importados' : '/alumno/horario'
    case 'TareasPendientes':
    case 'ReporteTareas':
      return '/tareas'
    case 'ReporteAsistencias':
      return '/asistencias'
    case 'Usuario':
      return '/usuarios'
    case 'EntregaTarea':
      return '/tareas'
    default:
      return null
  }
}
