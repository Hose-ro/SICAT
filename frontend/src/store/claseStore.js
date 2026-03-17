import { create } from 'zustand'
import api from '../api/axios'

export const useClaseStore = create((set) => ({
  sesionActiva: null,
  historial: [],
  misClasesActivas: [],
  loading: false,
  error: null,

  iniciar: async (materiaId, unidad) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/clases/iniciar', { materiaId, unidad })
      set({ sesionActiva: res.data })
      return res.data
    } catch (err) {
      set({ error: err.response?.data?.message || 'Error al iniciar clase' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  finalizar: async (id) => {
    set({ loading: true, error: null })
    try {
      await api.patch(`/clases/${id}/finalizar`)
      set({ sesionActiva: null })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Error al finalizar clase' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  obtenerActiva: async (materiaId) => {
    try {
      const res = await api.get(`/clases/activa/${materiaId}`)
      set({ sesionActiva: res.data })
      return res.data
    } catch {
      set({ sesionActiva: null })
    }
  },

  obtenerHistorial: async (materiaId) => {
    set({ loading: true })
    try {
      const res = await api.get(`/clases/historial/${materiaId}`)
      set({ historial: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerMisClasesActivas: async () => {
    try {
      const res = await api.get('/clases/mis-clases-activas')
      set({ misClasesActivas: res.data })
    } catch {}
  },
}))
