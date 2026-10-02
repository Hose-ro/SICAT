import { horaCorta, plazoTarea, TASK_TYPE_LABEL } from './tareas'

/**
 * Compartir con el grupo de WhatsApp de la clase. No hay API: en el celular se
 * usa el menú Compartir del sistema (manda el archivo directo); en la
 * computadora se descarga el archivo, se copia el mensaje y se abre el grupo.
 *
 * `compartirNativo` y `compartirConEnlace` deben llamarse directo desde el clic,
 * sin `await` antes: `navigator.share` y `window.open` exigen ese gesto.
 */

/** «martes 6 de octubre, 23:59»: en el chat se lee mejor que la fecha corta. */
function fechaMensaje(value) {
  const d = new Date(value)
  return `${d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}, ${horaCorta(d)}`
}

function encabezado(materia, grupo) {
  return [materia, grupo && `(${grupo})`].filter(Boolean).join(' ')
}

export function mensajeTareaNueva(tarea, { conDocumento = true } = {}) {
  const conFecha = tarea.tieneFechaLimite && tarea.fechaLimite
  return [
    `📚 *Nueva tarea* · ${encabezado(tarea.materia?.nombre, tarea.grupo?.nombre)}`,
    `*${tarea.titulo}*`,
    `📅 Entrega: ${conFecha ? fechaMensaje(tarea.fechaLimite) : 'sin fecha límite'}`,
    TASK_TYPE_LABEL[tarea.tipoEntrega] && `📝 ${TASK_TYPE_LABEL[tarea.tipoEntrega]}`,
    conDocumento && 'Las instrucciones completas van en el documento adjunto.',
  ].filter(Boolean).join('\n')
}

export function mensajeRecordatorio(tarea, ahora = new Date(), { conDocumento = false } = {}) {
  const plazo = plazoTarea(tarea, ahora)
  const titulo = `*${tarea.titulo}*`
  const fecha = plazo.dias === null ? '' : fechaMensaje(tarea.fechaLimite)
  let cuando
  if (plazo.dias === null) cuando = `La tarea ${titulo} sigue abierta: aún pueden entregarla.`
  else if (plazo.vencido) cuando = `El plazo de ${titulo} venció (${fecha}).`
  else if (plazo.dias === 0) cuando = `La tarea ${titulo} vence *hoy* a las ${horaCorta(tarea.fechaLimite)}.`
  else if (plazo.dias === 1) cuando = `La tarea ${titulo} vence *mañana* (${fecha}).`
  else cuando = `Faltan *${plazo.dias} días* para entregar ${titulo} (${fecha}).`
  return [
    `⏰ *Recordatorio* · ${encabezado(tarea.materia?.nombre, tarea.grupo?.nombre)}`,
    cuando,
    conDocumento && 'Les reenvío las instrucciones en el documento adjunto.',
  ].filter(Boolean).join('\n')
}

export function mensajeAviso(aviso, materia, grupo) {
  return [
    `📢 *Aviso* · ${encabezado(materia, grupo)}`,
    `*${aviso.titulo}*`,
    aviso.cuerpo,
  ].filter(Boolean).join('\n')
}

export function enlaceWaMe(texto) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

/** ¿El navegador puede mandar este archivo por el menú Compartir del sistema? */
export function puedeCompartirArchivo(archivo) {
  if (!archivo || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [archivo] })
  } catch {
    return false
  }
}

function copiar(texto) {
  if (!navigator.clipboard?.writeText) return Promise.resolve(false)
  return navigator.clipboard.writeText(texto).then(() => true, () => false)
}

function descargar(archivo) {
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.name
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Menú Compartir del celular con el archivo y el texto. El texto también se
 * copia: WhatsApp en iOS a veces lo descarta al recibir un archivo.
 * Devuelve 'compartido' o 'cancelado'.
 */
export async function compartirNativo({ texto, archivo }) {
  const copiado = copiar(texto)
  try {
    await navigator.share({ files: [archivo], text: texto })
    await copiado
    return 'compartido'
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelado'
    throw error
  }
}

/**
 * Descarga el archivo (si hay), copia el texto y abre el grupo guardado; sin
 * grupo, abre WhatsApp con el texto ya escrito para elegir el chat.
 * Devuelve { destino: 'grupo' | 'wame', copiado }.
 */
export async function compartirConEnlace({ texto, archivo, enlaceGrupo }) {
  const destino = enlaceGrupo ? 'grupo' : 'wame'
  window.open(enlaceGrupo || enlaceWaMe(texto), '_blank', 'noopener,noreferrer')
  if (archivo) descargar(archivo)
  const copiado = await copiar(texto)
  return { destino, copiado }
}
