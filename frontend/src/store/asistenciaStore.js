import { create } from 'zustand'
import api from '../api/axios'

function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = nombre
  anchor.click()
  URL.revokeObjectURL(url)
}

export const useAsistenciaStore = create((set) => ({
  listaActual: null,
  resumen: [],
  historial: [],
  estadisticas: null,
  misAsistencias: [],
  loading: false,
  error: null,

  pasarLista: async (claseSesionId, registros) => {
    set({ loading: true, error: null })
    try {
      const response = await api.post('/asistencias/pasar-lista', { claseSesionId, registros })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al guardar la asistencia' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerListaSesion: async (claseSesionId) => {
    set({ loading: true, error: null })
    try {
      const response = await api.get(`/asistencias/sesion/${claseSesionId}`)
      set({ listaActual: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar la sesión' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerResumen: async (materiaId, unidadId) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (unidadId) params.set('unidadId', unidadId)
      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await api.get(`/asistencias/materia/${materiaId}${query}`)
      set({ resumen: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar el resumen' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerHistorial: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value)
        }
      })
      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await api.get(`/asistencias/historial${query}`)
      set({
        historial: response.data.items ?? [],
        estadisticas: response.data.estadisticas ?? null,
      })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar el historial' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  actualizarAsistencia: async (asistenciaId, data) => {
    set({ loading: true, error: null })
    try {
      const response = await api.patch(`/asistencias/${asistenciaId}`, data)
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al actualizar la asistencia' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerMisAsistencias: async (materiaId) => {
    set({ loading: true, error: null })
    try {
      const response = await api.get(`/asistencias/mis-asistencias/${materiaId}`)
      set({ misAsistencias: response.data })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.message || 'Error al cargar tus asistencias' })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  justificar: async (id, justificacion, archivo) => {
    const formData = new FormData()
    formData.append('justificacion', justificacion)
    if (archivo) formData.append('archivo', archivo)
    const response = await api.post(`/asistencias/${id}/justificar`, formData)
    return response.data
  },

  exportar: async (materiaId, options = {}, legacyUnidadId) => {
    const normalized = typeof options === 'string'
      ? { formato: options, unidadId: legacyUnidadId }
      : options

    const {
      formato = 'excel',
      sesionId,
      grupoId,
      fecha,
      semana,
      unidadId,
      docenteId,
    } = normalized

    const params = new URLSearchParams({ formato })
    if (sesionId) params.set('sesionId', sesionId)
    if (grupoId) params.set('grupoId', grupoId)
    if (fecha) params.set('fecha', fecha)
    if (semana) params.set('semana', semana)
    if (unidadId) params.set('unidadId', unidadId)
    if (docenteId) params.set('docenteId', docenteId)

    const response = await api.get(`/asistencias/exportar/${materiaId}?${params.toString()}`, {
      responseType: 'blob',
    })
    descargarArchivo(
      response.data,
      `asistencias-${materiaId}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`,
    )
  },
}))
