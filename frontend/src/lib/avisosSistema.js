// Avisos del sistema operativo (la notificación que sale fuera del navegador)
// mientras SICAT está abierto, aunque sea en otra pestaña. No es push: con la
// app cerrada no llegan.
import { notify } from './feedback'
import { resolveNotificationRoute } from './notificaciones'

/** Tipos de notificación que además salen como aviso del sistema. */
export const TIPOS_CON_AVISO = new Set(['CLASE_INICIADA'])

// Más viejo que esto ya no vale la pena avisarlo: la clase lleva rato.
const VIGENCIA_MS = 15 * 60 * 1000
const CLAVE_MOSTRADOS = 'sicat-avisos-mostrados'

export function avisosSoportados() {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function permisoAvisos() {
  return avisosSoportados() ? window.Notification.permission : 'unsupported'
}

export async function pedirPermisoAvisos() {
  if (!avisosSoportados()) return 'unsupported'
  return window.Notification.requestPermission()
}

function leerMostrados() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_MOSTRADOS) ?? '[]')
  } catch {
    return []
  }
}

function guardarMostrado(id) {
  try {
    localStorage.setItem(CLAVE_MOSTRADOS, JSON.stringify([...leerMostrados(), id].slice(-50)))
  } catch { /* Sin almacenamiento sólo se pierde la protección contra repetidos. */ }
}

/**
 * Decide si una notificación nueva merece aviso: del tipo correcto, reciente
 * y no mostrada antes en este navegador.
 */
export function debeAvisar(notificacion, ahora = Date.now()) {
  if (!TIPOS_CON_AVISO.has(notificacion.tipo) || notificacion.leida) return false
  if (ahora - new Date(notificacion.createdAt).getTime() > VIGENCIA_MS) return false
  return !leerMostrados().includes(notificacion.id)
}

/**
 * Con SICAT a la vista basta un aviso dentro de la app; con la pestaña
 * oculta (o el navegador minimizado) sale el del sistema, si hay permiso.
 */
export async function avisarNotificacion(notificacion) {
  if (!debeAvisar(notificacion)) return
  if (!document.hidden) {
    guardarMostrado(notificacion.id)
    notify(`${notificacion.titulo}. ${notificacion.mensaje}`, 'info')
    return
  }
  await mostrarAvisoSistema(notificacion)
}

/**
 * Muestra el aviso del sistema. En Android sólo funciona por el service
 * worker; sin él (por ejemplo en desarrollo) se usa la API directa.
 */
export async function mostrarAvisoSistema(notificacion) {
  if (permisoAvisos() !== 'granted') return false
  guardarMostrado(notificacion.id)
  // Hoy sólo se avisa CLASE_INICIADA, que sólo reciben los alumnos.
  const url = resolveNotificationRoute(notificacion, 'ALUMNO')
  const opciones = {
    body: notificacion.mensaje,
    tag: `notificacion-${notificacion.id}`,
    icon: '/pwa-192.png',
    data: { url },
  }
  try {
    const registro = await navigator.serviceWorker?.getRegistration?.()
    if (registro) {
      await registro.showNotification(notificacion.titulo, opciones)
      return true
    }
    const aviso = new window.Notification(notificacion.titulo, opciones)
    aviso.onclick = () => {
      window.focus()
      window.location.assign(url)
    }
    return true
  } catch {
    return false
  }
}
