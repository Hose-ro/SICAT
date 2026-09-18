import { create } from 'zustand'
import api from '../api/axios'

/**
 * Los dos calendarios del periodo en curso (`escolarizado` y `mixto`), con
 * `aplica` marcando cuáles le tocan al usuario y `rango` con la unión de sus
 * fechas.
 */
export const usePeriodoStore = create((set) => ({
  periodos: null,
  loading: false,
  error: null,

  cargarPeriodos: async () => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/periodos/actual')
      set({ periodos: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'No se pudo cargar el periodo escolar' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  guardarPeriodo: async ({ modalidad, fechaInicio, fechaFin }) => {
    const response = await api.put('/periodos/actual', { modalidad, fechaInicio, fechaFin })
    set({ periodos: response.data })
    return response.data
  },
}))
