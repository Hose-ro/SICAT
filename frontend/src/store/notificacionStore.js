import { create } from 'zustand'
import api from '../api/axios'

export const useNotificacionStore = create((set, get) => ({
  notificaciones: [],
  noLeidas: 0,
  total: 0,
  loading: false,

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

  contarNoLeidas: async () => {
    try {
      const res = await api.get('/notificaciones/no-leidas')
      set({ noLeidas: res.data })
    } catch {}
  },

  marcarLeida: async (id) => {
    await api.patch(`/notificaciones/${id}/leer`)
    set((state) => ({
      notificaciones: state.notificaciones.map((n) => n.id === id ? { ...n, leida: true } : n),
      noLeidas: Math.max(0, state.noLeidas - 1),
    }))
  },

  marcarTodasLeidas: async () => {
    await api.patch('/notificaciones/leer-todas')
    set((state) => ({
      notificaciones: state.notificaciones.map((n) => ({ ...n, leida: true })),
      noLeidas: 0,
    }))
  },

  eliminar: async (id) => {
    await api.delete(`/notificaciones/${id}`)
    set((state) => {
      const eliminada = state.notificaciones.find((item) => item.id === id)
      return {
        notificaciones: state.notificaciones.filter((item) => item.id !== id),
        total: Math.max(0, state.total - 1),
        noLeidas:
          eliminada && !eliminada.leida
            ? Math.max(0, state.noLeidas - 1)
            : state.noLeidas,
      }
    })
  },
}))
