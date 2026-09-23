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

// Con responseType 'blob' el cuerpo del error también llega como Blob.
async function leerMensajeBlob(data) {
  if (!(data instanceof Blob)) return data?.message ?? null
  try {
    return JSON.parse(await data.text())?.message ?? null
  } catch {
    return null
  }
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

  // `silent` recarga sin vaciar la tabla, para no desmontar los campos que el
  // docente está editando.
  obtenerDocente: async (filters = {}, { silent = false } = {}) => {
    set(silent ? { error: null } : { loading: true, error: null })
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
      if (!silent) set({ loading: false })
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

  // Guarda varias capturas en una sola petición; el servidor responde con el
  // reporte ya recalculado.
  guardarLote: async (payload, filters = {}) => {
    set({ error: null })
    try {
      const response = await api.patch('/calificaciones/manual/lote', payload, {
        params: limpiarFiltros(filters),
      })
      set({ reporteDocente: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al guardar las calificaciones' })
      throw error
    }
  },

  guardarPonderacion: async (payload) => {
    set({ error: null })
    try {
      const response = await api.patch('/calificaciones/ponderacion', payload)
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al guardar la ponderación' })
      throw error
    }
  },

  exportarCaptura: async (filters = {}, formato = 'excel', nombreBase = 'calificaciones-captura') => {
    set({ error: null })
    try {
      const response = await api.get('/calificaciones/exportar', {
        params: limpiarFiltros({ ...filters, formato }),
        responseType: 'blob',
      })
      const extension = formato === 'csv' ? 'csv' : 'xlsx'
      descargarArchivo(response.data, `${nombreBase}.${extension}`)
    } catch (error) {
      set({ error: (await leerMensajeBlob(error.response?.data)) || 'No se pudo generar la exportación' })
      throw error
    }
  },
}))
