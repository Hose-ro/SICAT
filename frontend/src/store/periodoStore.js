import { create } from 'zustand'
import api from '../api/axios'

export const usePeriodoStore = create((set) => ({
  periodo: null,
  loading: false,
  error: null,

  cargarPeriodo: async () => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/periodos/actual')
      set({ periodo: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'No se pudo cargar el periodo escolar' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  guardarPeriodo: async ({ fechaInicio, fechaFin }) => {
    const response = await api.put('/periodos/actual', { fechaInicio, fechaFin })
    set({ periodo: response.data })
    return response.data
  },
}))
