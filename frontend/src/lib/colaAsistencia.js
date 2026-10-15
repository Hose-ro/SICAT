import api from '@/api/axios'
import { notify } from '@/lib/feedback'

/*
 * Pase de lista en el dispositivo. En el salón la señal se cae y el teléfono
 * se bloquea, así que hay dos capas, ambas en localStorage y sólo con ids y
 * estados (los nombres vienen del servidor):
 *  - borrador: lo que se lleva marcado y aún no se intenta guardar;
 *  - cola: listas que se intentaron guardar sin conexión y se envían solas
 *    cuando vuelve la señal.
 */
const PREFIJO_BORRADOR = 'sicat:pase-lista:'
const CLAVE_COLA = 'sicat:pase-lista-cola'
export const EVENTO_COLA = 'sicat:cola-asistencia'

export function leerBorrador(sesionId) {
  try {
    const guardado = localStorage.getItem(`${PREFIJO_BORRADOR}${sesionId}`)
    return guardado ? JSON.parse(guardado) : null
  } catch {
    return null
  }
}

export function escribirBorrador(sesionId, borrador) {
  try {
    localStorage.setItem(`${PREFIJO_BORRADOR}${sesionId}`, JSON.stringify(borrador))
    return true
  } catch {
    return false
  }
}

export function borrarBorrador(sesionId) {
  try {
    localStorage.removeItem(`${PREFIJO_BORRADOR}${sesionId}`)
  } catch {
    // Sin almacenamiento no hay borrador que borrar.
  }
}

function leerCola() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]')
  } catch {
    return []
  }
}

function escribirCola(cola) {
  try {
    if (cola.length) localStorage.setItem(CLAVE_COLA, JSON.stringify(cola))
    else localStorage.removeItem(CLAVE_COLA)
    return true
  } catch {
    return false
  }
}

/** La lista pendiente de una sesión, o null. */
export function enCola(sesionId) {
  return leerCola().find((item) => item.sesionId === sesionId) ?? null
}

/** Guarda (o reemplaza) la lista de una sesión para enviarla después. */
export function encolar({ sesionId, materia, registros }) {
  const cola = leerCola().filter((item) => item.sesionId !== sesionId)
  return escribirCola([...cola, { sesionId, materia, registros, encoladoEn: Date.now() }])
}

export function quitarDeCola(sesionId) {
  escribirCola(leerCola().filter((item) => item.sesionId !== sesionId))
}

const sinConexion = (error) => !error?.response?.status
let enviando = null

/**
 * Intenta mandar lo pendiente. Si la red sigue caída, todo se queda para el
 * siguiente intento; si el servidor rechaza una lista, se avisa y se suelta
 * (su borrador sigue en el dispositivo para corregirla a mano).
 */
export function procesarCola() {
  if (enviando) return enviando
  enviando = (async () => {
    for (const item of leerCola()) {
      try {
        const resultado = await api.post('/asistencias/pasar-lista', { claseSesionId: item.sesionId, registros: item.registros })
        quitarDeCola(item.sesionId)
        borrarBorrador(item.sesionId)
        notify(`Se envió la lista de ${item.materia ?? 'la clase'} que quedó pendiente.`, 'success')
        window.dispatchEvent(new CustomEvent(EVENTO_COLA, { detail: { sesionId: item.sesionId, registros: item.registros, resultado } }))
      } catch (error) {
        if (sinConexion(error)) break
        quitarDeCola(item.sesionId)
        notify(`No se pudo enviar la lista de ${item.materia ?? 'la clase'}: ${error.response?.data?.message ?? 'el servidor la rechazó'}. Ábrela de nuevo para revisarla.`)
        window.dispatchEvent(new CustomEvent(EVENTO_COLA, { detail: { sesionId: item.sesionId, error: true } }))
      }
    }
  })().finally(() => { enviando = null })
  return enviando
}

/** Reintenta al recuperar la señal y cada 30 s mientras haya algo pendiente. */
export function vigilarCola() {
  const intentar = () => { if (leerCola().length) procesarCola() }
  intentar()
  window.addEventListener('online', intentar)
  const intervalo = setInterval(intentar, 30_000)
  return () => {
    window.removeEventListener('online', intentar)
    clearInterval(intervalo)
  }
}
