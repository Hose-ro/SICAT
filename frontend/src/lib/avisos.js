export function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}

export function fechaAviso(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
