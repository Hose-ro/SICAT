import { create } from 'zustand'
import api from '../api/axios'

function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = nombre
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function limpiarFiltros(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export const useCalificacionStore = create((set) => ({
  reporteDocente: null,
  reporteAlumno: null,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  obtenerDocente: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/calificaciones/docente', {
        params: limpiarFiltros(filters),
      })
      set({ reporteDocente: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar calificaciones' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerAlumno: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const response = await api.get('/calificaciones/alumno', {
        params: limpiarFiltros(filters),
      })
      set({ reporteAlumno: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar tus calificaciones' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  guardarManual: async (payload, filters = {}) => {
    set({ error: null })
    try {
      const response = await api.patch('/calificaciones/manual', payload, {
        params: limpiarFiltros(filters),
      })
      set({ reporteDocente: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al guardar calificacion' })
      throw error
    }
  },

  exportarCaptura: async (filters = {}, formato = 'excel') => {
    const response = await api.get('/calificaciones/exportar', {
      params: limpiarFiltros({ ...filters, formato }),
      responseType: 'blob',
    })
    const extension = formato === 'csv' ? 'csv' : 'xlsx'
    descargarArchivo(response.data, `calificaciones-captura.${extension}`)
  },
}))
