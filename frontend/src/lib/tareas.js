export const TASK_STATE_LABEL = {
  BORRADOR: 'Borrador', PUBLICADA: 'Publicada', VENCIDA: 'Plazo vencido', CERRADA: 'Cerrada',
}

export const DELIVERY_STATE_LABEL = {
  PENDIENTE: 'Por entregar', ENTREGADA: 'Por revisar', REVISADA: 'Revisada',
  INCORRECTA: 'Requiere atención', CALIFICADA: 'Calificada', NO_ENTREGADA: 'Sin entregar',
}

export const TASK_TYPE_LABEL = {
  EN_LINEA: 'Entrega con archivo', PRESENCIAL: 'En clase',
  FIRMA: 'Foto de firma', REVISION_EN_LINEA: 'Comentario o archivos',
}

export const TASK_TYPE_HELP = {
  EN_LINEA: 'El alumno debe adjuntar al menos un archivo PDF, Word o imagen.',
  PRESENCIAL: 'Se aplica o se entrega en clase: el alumno no sube nada. Después capturas las calificaciones en la lista.',
  FIRMA: 'El alumno debe adjuntar al menos una imagen de la firma o evidencia.',
  REVISION_EN_LINEA: 'El alumno puede enviar un comentario, archivos o ambos.',
}

// Tipo de actividad según el criterio con que cuenta (examen, práctica…).
// Sin criterio, o con uno de tareas, es una tarea.
const ACTIVIDADES = {
  EXAMEN: { singular: 'Examen', articulo: 'el examen', emoji: '📝', anuncio: 'Examen' },
  PRACTICAS: { singular: 'Práctica', articulo: 'la práctica', emoji: '🧪', anuncio: 'Nueva práctica' },
  PROYECTO: { singular: 'Proyecto', articulo: 'el proyecto', emoji: '📁', anuncio: 'Proyecto' },
  EXPOSICION: { singular: 'Exposición', articulo: 'la exposición', emoji: '🎤', anuncio: 'Exposición' },
}
const TAREA = { singular: 'Tarea', articulo: 'la tarea', emoji: '📚', anuncio: 'Nueva tarea' }

export function tipoActividad(tarea) {
  return ACTIVIDADES[tarea?.categoria?.tipo] ?? TAREA
}

/** Se aplica o se entrega en clase: nadie sube nada y el docente captura. */
export const esEnClase = (tarea) => tarea?.tipoEntrega === 'PRESENCIAL'

/**
 * Los archivos de tareas y entregas se sirven tras sesión desde la propia API
 * (`/api/uploads/tareas/...`), no desde la raíz del servidor; la cookie sólo
 * viaja bajo `/api`.
 */
export function taskFileUrl(url, apiBaseUrl) {
  if (!url) return '#'
  if (/^https?:\/\//i.test(url)) return url
  return `${String(apiBaseUrl || '').replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

export function taskError(error, fallback = 'No se pudo completar la acción. Intenta de nuevo.') {
  const message = error?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : typeof message === 'string' ? message : fallback
}

export function searchTasks(tasks, query, order = 'deadline') {
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const needle = normalize(query).trim()
  const taskOf = (item) => item.tarea || item
  const deadline = (item) => {
    const task = taskOf(item)
    return task.tieneFechaLimite && task.fechaLimite ? new Date(task.fechaLimite).getTime() : Infinity
  }
  return tasks.filter((item) => {
    const task = taskOf(item)
    return normalize([task.titulo, task.materia?.nombre, task.grupo?.nombre, task.unidadRef?.nombre].join(' ')).includes(needle)
  }).sort((a, b) => {
    if (order === 'title') return taskOf(a).titulo.localeCompare(taskOf(b).titulo, 'es')
    if (order === 'review') return (b.pendientesRevision || 0) - (a.pendientesRevision || 0)
    return deadline(a) - deadline(b) || taskOf(b).id - taskOf(a).id
  })
}

export function deliveryHelp(tarea, entrega, editable) {
  if (tarea.tipoEntrega === 'PRESENCIAL') return 'Se aplica en clase; tu docente captura la calificación.'
  if (tarea.estado === 'CERRADA') return 'La tarea está cerrada y no recibe entregas.'
  if (!editable) return 'El plazo para modificar tu entrega terminó. Consulta a tu docente si necesitas corregirla.'
  if (!entrega) return tarea.estado === 'VENCIDA'
    ? 'Puedes entregar; se registrará como entrega tardía.'
    : 'Prepara tu trabajo y envíalo desde el detalle de la tarea.'
  return 'Puedes actualizar tu entrega. El nuevo envío reemplaza la versión anterior y vuelve a revisión.'
}

export function mergeTaskFiles(current, incoming, imagesOnly = false) {
  const extensions = imagesOnly ? /\.(png|jpe?g|webp)$/i : /\.(pdf|docx?|png|jpe?g|webp)$/i
  const merged = [...current]
  for (const file of incoming) {
    if (!extensions.test(file.name)) throw new Error(`Formato no permitido: ${file.name}. ${imagesOnly ? 'Usa imágenes PNG, JPG o WebP.' : 'Usa PDF, Word, PNG, JPG o WebP.'}`)
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} supera el límite de 15 MB.`)
    if (!merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) merged.push(file)
  }
  if (merged.length > 12) throw new Error('Puedes agregar hasta 12 archivos por envío.')
  return merged
}

// ── Vista del docente ─────────────────────────────────────────────────

// Lo que le toca hacer al docente con cada entrega (el alumno ve DELIVERY_STATE_LABEL).
export const ESTADO_DOCENTE_LABEL = {
  ENTREGADA: 'Por calificar', REVISADA: 'Revisada', CALIFICADA: 'Calificada',
  INCORRECTA: 'Devuelta', NO_ENTREGADA: 'Sin entregar', PENDIENTE: 'Aún no entrega',
}

/** Etiqueta del estado para el docente; en clase no hay "entrega" que esperar. */
export function etiquetaEstadoDocente(estado, tarea) {
  if (esEnClase(tarea)) {
    if (estado === 'NO_ENTREGADA') return 'No presentó'
    if (estado === 'PENDIENTE') return 'Sin calificar'
  }
  return ESTADO_DOCENTE_LABEL[estado] ?? estado
}

/**
 * Etiqueta del estado para el alumno. En clase, "no presentó" sólo si el
 * docente lo registró (`registrada`); si no, todavía no hay calificación.
 */
export function etiquetaEstadoAlumno(estado, tarea, registrada = false) {
  if (esEnClase(tarea)) {
    if (estado === 'NO_ENTREGADA') return registrada ? 'No presentó' : 'Sin calificar'
    if (estado === 'PENDIENTE') return 'En clase'
    if (estado === 'ENTREGADA') return 'Por calificar'
  }
  return DELIVERY_STATE_LABEL[estado] ?? estado
}

/** Estado de una fila de GET /tareas/:id/entregas visto por el docente. */
export function estadoDocente(entrega) {
  if (!entrega || entrega.esSintetica) return entrega?.estadoRevision === 'NO_ENTREGADA' ? 'NO_ENTREGADA' : 'PENDIENTE'
  if (entrega.estadoRevision === 'PENDIENTE' || entrega.estadoRevision === 'ENTREGADA') return 'ENTREGADA'
  return entrega.estadoRevision
}

/** Conteos de una tarea del listado. `revisadas`/`devueltas` pueden faltar si el API es anterior. */
export function conteoTarea(task) {
  const total = task.totalAlumnos ?? 0
  const entregadas = task.entregadas ?? 0
  const porCalificar = task.pendientesRevision ?? 0
  const calificadas = task.calificadas ?? 0
  const devueltas = task.devueltas ?? 0
  const revisadas = task.revisadas ?? Math.max(entregadas - calificadas - porCalificar - devueltas, 0)
  return { total, entregadas, porCalificar, calificadas, revisadas, devueltas, sinEntregar: Math.max(total - entregadas, 0), noPresentaron: task.noPresentaron ?? 0, promedio: task.promedio ?? null }
}

/** Conteos a partir de las filas de entregas de una tarea. */
export function conteoEntregas(entregas) {
  const r = { total: entregas.length, entregadas: 0, porCalificar: 0, calificadas: 0, revisadas: 0, devueltas: 0, sinEntregar: 0, noPresentaron: 0, tardias: 0, promedio: null }
  let suma = 0
  let notas = 0
  for (const entrega of entregas) {
    const estado = estadoDocente(entrega)
    if (estado === 'PENDIENTE' || estado === 'NO_ENTREGADA') {
      r.sinEntregar += 1
      // Registrado por el docente en una actividad en clase: cuenta con 0.
      if (estado === 'NO_ENTREGADA' && entrega && !entrega.esSintetica) r.noPresentaron += 1
      continue
    }
    r.entregadas += 1
    if (entrega.fueTardia) r.tardias += 1
    if (estado === 'ENTREGADA') r.porCalificar += 1
    if (estado === 'REVISADA') r.revisadas += 1
    if (estado === 'INCORRECTA') r.devueltas += 1
    if (estado === 'CALIFICADA') {
      r.calificadas += 1
      if (typeof entrega.calificacion === 'number') { suma += entrega.calificacion; notas += 1 }
    }
  }
  r.promedio = notas ? Math.round((suma / notas) * 10) / 10 : null
  return r
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function inicioDelDia(value) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

export function fechaCorta(value) {
  const d = new Date(value)
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`
}

export function horaCorta(value) {
  const d = new Date(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fechaHoraCorta(value) {
  return value ? `${fechaCorta(value)}, ${horaCorta(value)}` : 'Sin fecha'
}

/** «21 sep – 16 oct»; vacío si la unidad no tiene fechas. */
export function rangoFechas(inicio, fin) {
  const corta = (value) => { const d = new Date(value); return `${d.getDate()} ${MESES[d.getMonth()]}` }
  if (inicio && fin) return `${corta(inicio)} – ${corta(fin)}`
  if (inicio) return `Desde el ${corta(inicio)}`
  if (fin) return `Hasta el ${corta(fin)}`
  return ''
}

/** Plazo relativo: «Venció ayer», «Hoy», «En 3 días» y la fecha exacta. */
export function plazoTarea(tarea, ahora = new Date()) {
  if (!tarea.tieneFechaLimite || !tarea.fechaLimite) return { texto: '', relativo: 'Sin fecha límite', vencido: false, dias: null }
  const limite = new Date(tarea.fechaLimite)
  const dias = Math.round((inicioDelDia(limite) - inicioDelDia(ahora)) / 86400000)
  const vencido = limite < ahora
  let relativo
  if (dias === 0) relativo = vencido ? 'Venció hoy' : 'Hoy'
  else if (dias === -1) relativo = 'Venció ayer'
  else if (dias === 1) relativo = 'Mañana'
  else if (dias < 0) relativo = `Venció hace ${-dias} días`
  else relativo = `En ${dias} días`
  return { texto: fechaHoraCorta(limite), relativo, vencido, dias }
}

/** Criterios de la rúbrica ([{ criterio, peso }]) o null si el formato no es compatible. */
export function parseRubrica(rubricJson) {
  if (!rubricJson) return null
  let rows
  try { rows = JSON.parse(rubricJson) } catch { return null }
  if (!Array.isArray(rows) || !rows.length) return null
  if (!rows.every((row) => row && typeof row.criterio === 'string' && Number.isFinite(Number(row.peso)) && Number(row.peso) > 0)) return null
  return rows.map((row) => ({ criterio: row.criterio, peso: Number(row.peso) }))
}

/** El API acepta calificaciones numéricas de 1 a 100. */
export function notaValida(texto, maximo = 100, minimo = 1) {
  if (texto === '' || texto === null || texto === undefined) return false
  const n = Number(texto)
  return Number.isFinite(n) && n >= minimo && n <= maximo
}

export const COMENTARIOS_FRECUENTES = [
  'Buen trabajo.',
  'Faltan evidencias de algunos pasos.',
  'Revisa la ortografía.',
  'Justifica tus decisiones.',
  'Cita tus fuentes.',
]
