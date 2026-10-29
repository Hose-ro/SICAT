/**
 * Enter baja y Shift+Enter sube entre las celdas de calificación de una
 * misma columna, como en una hoja de cálculo. Las celdas llevan
 * `data-captura="calificacion"` y `data-columna`, dentro de un contenedor con
 * `data-captura-grupo`; las deshabilitadas se saltan.
 */
export function moverFoco(event) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const { columna } = event.currentTarget.dataset
  const grupo = event.currentTarget.closest('[data-captura-grupo]')
  const inputs = [...grupo.querySelectorAll(`input[data-captura="calificacion"][data-columna="${columna}"]:not(:disabled)`)]
  const next = inputs[inputs.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)]
  if (next) {
    next.focus()
    next.select()
  }
}
