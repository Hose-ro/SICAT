import { useEffect } from 'react'
import { create } from 'zustand'
import api from '../api/axios'

const POLL_MS = 30000

// The bell and the history page keep separate lists: opening the bell must
// not replace the page the user is reading in the history.
const marcar = (lista, id) => lista.map((n) => (n.id === id ? { ...n, leida: true } : n))

export const useNotificacionStore = create((set, get) => ({
  notificaciones: [],
  recientes: [],
  noLeidas: 0,
  total: 0,
  loading: false,
  loadingRecientes: false,

  obtener: async ({ skip = 0, take = 20, soloNoLeidas = false } = {}) => {
    set({ loading: true })
    try {
      const res = await api.get('/notificaciones', {
        params: { skip, take, soloNoLeidas },
      })
      set({
        notificaciones: res.data.items || [],
        total: res.data.total || 0,
      })
      return res.data
    } finally {
      set({ loading: false })
    }
  },

  obtenerRecientes: async () => {
    set({ loadingRecientes: true })
    try {
      const res = await api.get('/notificaciones', { params: { skip: 0, take: 10 } })
      set({ recientes: res.data.items || [] })
    } finally {
      set({ loadingRecientes: false })
    }
  },

  contarNoLeidas: async () => {
    try {
      const res = await api.get('/notificaciones/no-leidas')
      set({ noLeidas: res.data })
    } catch { /* Keep the previous count while the service is unavailable. */ }
  },

  marcarLeida: async (id) => {
    await api.patch(`/notificaciones/${id}/leer`)
    set((state) => {
      const pendiente = [...state.notificaciones, ...state.recientes].some((n) => n.id === id && !n.leida)
      return {
        notificaciones: marcar(state.notificaciones, id),
        recientes: marcar(state.recientes, id),
        noLeidas: pendiente ? Math.max(0, state.noLeidas - 1) : state.noLeidas,
      }
    })
  },

  marcarTodasLeidas: async () => {
    await api.patch('/notificaciones/leer-todas')
    set((state) => ({
      notificaciones: state.notificaciones.map((n) => ({ ...n, leida: true })),
      recientes: state.recientes.map((n) => ({ ...n, leida: true })),
      noLeidas: 0,
    }))
  },

  eliminar: async (id) => {
    await api.delete(`/notificaciones/${id}`)
    set((state) => {
      const eliminada = [...state.notificaciones, ...state.recientes].find((item) => item.id === id)
      return {
        notificaciones: state.notificaciones.filter((item) => item.id !== id),
        recientes: state.recientes.filter((item) => item.id !== id),
        total: Math.max(0, state.total - 1),
        noLeidas:
          eliminada && !eliminada.leida
            ? Math.max(0, state.noLeidas - 1)
            : state.noLeidas,
      }
    })
  },

  // One shared poller regardless of how many bells are mounted. It sleeps
  // while the tab is hidden and refreshes as soon as the user comes back.
  _poll: { suscriptores: 0, timer: null, onVisible: null, ultimo: 0 },
  iniciarSondeo: () => {
    const poll = get()._poll
    poll.suscriptores += 1
    if (poll.timer) return
    // `focus` and `visibilitychange` fire together when returning to the tab;
    // one request every few seconds is plenty.
    const tick = () => {
      if (document.hidden || Date.now() - poll.ultimo < 5000) return
      poll.ultimo = Date.now()
      get().contarNoLeidas()
    }
    tick()
    poll.timer = setInterval(tick, POLL_MS)
    poll.onVisible = tick
    document.addEventListener('visibilitychange', poll.onVisible)
    window.addEventListener('focus', poll.onVisible)
  },
  detenerSondeo: () => {
    const poll = get()._poll
    poll.suscriptores = Math.max(0, poll.suscriptores - 1)
    if (poll.suscriptores > 0 || !poll.timer) return
    clearInterval(poll.timer)
    document.removeEventListener('visibilitychange', poll.onVisible)
    window.removeEventListener('focus', poll.onVisible)
    poll.timer = null
    poll.onVisible = null
  },
}))

export function useNotificacionesPolling() {
  const iniciar = useNotificacionStore((s) => s.iniciarSondeo)
  const detener = useNotificacionStore((s) => s.detenerSondeo)
  useEffect(() => {
    iniciar()
    return detener
  }, [iniciar, detener])
}
