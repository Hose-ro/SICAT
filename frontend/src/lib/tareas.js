export const TASK_STATE_LABEL = {
  BORRADOR: 'Borrador', PUBLICADA: 'Publicada', VENCIDA: 'Plazo vencido', CERRADA: 'Cerrada',
}

export const DELIVERY_STATE_LABEL = {
  PENDIENTE: 'Por entregar', ENTREGADA: 'Por revisar', REVISADA: 'Revisada',
  INCORRECTA: 'Requiere atención', CALIFICADA: 'Calificada', NO_ENTREGADA: 'Sin entregar',
}

export const TASK_TYPE_LABEL = {
  EN_LINEA: 'Entrega con archivo', PRESENCIAL: 'Entrega presencial',
  FIRMA: 'Foto de firma', REVISION_EN_LINEA: 'Comentario o archivos',
}

export const TASK_TYPE_HELP = {
  EN_LINEA: 'El alumno debe adjuntar al menos un archivo PDF, Word o imagen.',
  PRESENCIAL: 'El docente registra la entrega en clase. El alumno no sube archivos.',
  FIRMA: 'El alumno debe adjuntar al menos una imagen de la firma o evidencia.',
  REVISION_EN_LINEA: 'El alumno puede enviar un comentario, archivos o ambos.',
}

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
  if (tarea.tipoEntrega === 'PRESENCIAL') return 'Tu docente registra la entrega en clase.'
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
