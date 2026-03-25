import { create } from 'zustand'
import api from '../api/axios'

export const useClaseStore = create((set) => ({
  sesionActiva: null,
  historial: [],
  panelDocente: null,
  misClasesActivas: [],
  loading: false,
  error: null,

  iniciar: async (payload) => {
    set({ loading: true, error: null })
    try {
      const body = typeof payload === 'number' ? { horarioId: payload } : payload
      const response = await api.post('/clases/iniciar', body)
      set({ sesionActiva: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al iniciar la clase' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  finalizar: async (id) => {
    set({ loading: true, error: null })
    try {
      const response = await api.patch(`/clases/${id}/finalizar`)
      set({ sesionActiva: null })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al finalizar la clase' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  cargarPanelDocente: async () => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/clases/docente/panel')
      set({ panelDocente: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar tus clases' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerActiva: async (materiaId) => {
    try {
      const response = await api.get(`/clases/activa/${materiaId}`)
      set({ sesionActiva: response.data })
      return response.data
    } catch (error) {
      set({ sesionActiva: null })
      throw error
    }
  },

  obtenerHistorial: async (materiaId) => {
    set({ loading: true, error: null })
    try {
      const response = await api.get(`/clases/historial/${materiaId}`)
      set({ historial: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar el historial' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerMisClasesActivas: async () => {
    try {
      const response = await api.get('/clases/mis-clases-activas')
      set({ misClasesActivas: response.data })
      return response.data
    } catch (error) {
      set({ misClasesActivas: [] })
      throw error
    }
  },
}))
