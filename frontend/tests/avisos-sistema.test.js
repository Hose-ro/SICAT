import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { avisarNotificacion, debeAvisar } from '../src/lib/avisosSistema'
import { useFeedbackStore } from '../src/lib/feedback'

const AHORA = new Date(2026, 8, 16, 10, 30)
const clase = (id, minutos = 1, extra = {}) => ({
 id, tipo: 'CLASE_INICIADA', leida: false, titulo: 'Clase iniciada: Cálculo',
 mensaje: 'La clase de Cálculo ha iniciado.', referenciaTipo: 'Materia', referenciaId: 1,
 createdAt: new Date(AHORA.getTime() - minutos * 60000).toISOString(), ...extra,
})

let oculto = false
const avisos = []
class NotificationFalsa {
 static permission = 'granted'
 constructor(titulo, opciones) { avisos.push({ titulo, ...opciones }) }
}

beforeEach(() => {
 vi.useFakeTimers({ now: AHORA })
 localStorage.clear()
 avisos.length = 0
 oculto = false
 Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculto })
 window.Notification = NotificationFalsa
 useFeedbackStore.setState({ confirmation: null, notices: [] })
})
afterEach(() => vi.useRealTimers())

test('sólo avisa clases iniciadas recientes y no leídas', () => {
 expect(debeAvisar(clase(1))).toBe(true)
 expect(debeAvisar(clase(2, 20))).toBe(false)
 expect(debeAvisar(clase(3, 1, { leida: true }))).toBe(false)
 expect(debeAvisar(clase(4, 1, { tipo: 'TAREA_NUEVA' }))).toBe(false)
})

test('con la pestaña oculta sale el aviso del sistema y lleva a la materia', async () => {
 oculto = true
 await avisarNotificacion(clase(1))
 expect(avisos).toEqual([expect.objectContaining({ titulo: 'Clase iniciada: Cálculo', body: 'La clase de Cálculo ha iniciado.', data: { url: '/alumno/materias/1' } })])
 // No se repite aunque la campana la vuelva a traer.
 await avisarNotificacion(clase(1))
 expect(avisos).toHaveLength(1)
})

test('con SICAT a la vista basta un aviso dentro de la app', async () => {
 await avisarNotificacion(clase(1))
 expect(avisos).toHaveLength(0)
 expect(useFeedbackStore.getState().notices.map((n) => n.message)).toEqual([
  'Clase iniciada: Cálculo. La clase de Cálculo ha iniciado.',
 ])
})

test('sin permiso no sale aviso del sistema', async () => {
 oculto = true
 NotificationFalsa.permission = 'denied'
 await avisarNotificacion(clase(1))
 expect(avisos).toHaveLength(0)
 NotificationFalsa.permission = 'granted'
})
