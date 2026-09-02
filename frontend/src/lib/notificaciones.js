import {
  CiAlarmOn,
  CiBellOn,
  CiCalendar,
  CiCalendarDate,
  CiCircleCheck,
  CiCircleRemove,
  CiInboxIn,
  CiRead,
  CiStickyNote,
  CiSun,
  CiUser,
  CiViewList,
} from 'react-icons/ci'

export const NOTIFICATION_META = {
  INSCRIPCION_NUEVA: { icon: CiStickyNote, label: 'Solicitud' },
  INSCRIPCION_ACEPTADA: { icon: CiCircleCheck, label: 'Solicitud aceptada' },
  INSCRIPCION_RECHAZADA: { icon: CiCircleRemove, label: 'Solicitud rechazada' },
  SOLICITUD_MATERIA: { icon: CiStickyNote, label: 'Solicitud' },
  SOLICITUD_ACEPTADA: { icon: CiCircleCheck, label: 'Solicitud aceptada' },
  SOLICITUD_RECHAZADA: { icon: CiCircleRemove, label: 'Solicitud rechazada' },
  CLASE_POR_INICIAR: { icon: CiAlarmOn, label: 'Clase por iniciar' },
  CLASE_INICIADA: { icon: CiSun, label: 'Clase' },
  CLASE_FINALIZADA: { icon: CiCalendar, label: 'Clase' },
  TAREA_NUEVA: { icon: CiRead, label: 'Tarea' },
  NUEVA_TAREA: { icon: CiRead, label: 'Tarea' },
  TAREA_REVISADA: { icon: CiViewList, label: 'Revisión' },
  TAREA_CALIFICADA: { icon: CiCalendarDate, label: 'Calificación' },
  CALIFICACION_DISPONIBLE: { icon: CiCalendarDate, label: 'Calificación' },
  OBSERVACION_DOCENTE: { icon: CiStickyNote, label: 'Observación' },
  ENTREGA_RECIBIDA: { icon: CiInboxIn, label: 'Entrega' },
  ENTREGA_TAREA: { icon: CiInboxIn, label: 'Entrega' },
  ENTREGA_TARDIA: { icon: CiCalendar, label: 'Entrega tardía' },
  ENTREGA_TARDIA_DOCENTE: { icon: CiCalendar, label: 'Entrega tardía' },
  ENTREGA_CORREGIDA: { icon: CiCircleCheck, label: 'Corrección' },
  ENTREGA_INCORRECTA: { icon: CiCircleRemove, label: 'Entrega incorrecta' },
  RECORDATORIO_FECHA_LIMITE: { icon: CiCalendarDate, label: 'Recordatorio' },
  TAREAS_PENDIENTES_REVISION: { icon: CiViewList, label: 'Pendientes' },
  ASISTENCIA_FUERA_HORARIO: { icon: CiCalendar, label: 'Asistencia' },
  NUEVO_USUARIO: { icon: CiUser, label: 'Usuario' },
  MATERIA_CREADA: { icon: CiRead, label: 'Materia' },
  REPORTE_DISPONIBLE: { icon: CiCalendarDate, label: 'Reporte' },
  ALERTA_ADMIN: { icon: CiBellOn, label: 'Alerta' },
}

export function getNotificationMeta(tipo) {
  return NOTIFICATION_META[tipo] || { icon: CiBellOn, label: 'Notificación' }
}

export function formatNotificationTime(fecha) {
  if (!fecha) return ''
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(fecha).toLocaleString('es-MX')
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
    case 'Materia':
      if (!referenciaId) return '/materias'
      return rol === 'ALUMNO'
        ? `/alumno/materias/${referenciaId}`
        : `/materias/${referenciaId}`
    case 'Asistencias':
    case 'ClaseSesion':
    case 'HorarioMateria':
      return '/asistencias'
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
