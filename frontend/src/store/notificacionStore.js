import { create } from 'zustand'
import api from '../api/axios'

export const useNotificacionStore = create((set, get) => ({
  notificaciones: [],
  noLeidas: 0,
  loading: false,

  obtener: async (skip = 0, take = 20) => {
    set({ loading: true })
    try {
      const res = await api.get(`/notificaciones?skip=${skip}&take=${take}`)
      set({ notificaciones: res.data.items })
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
}))
