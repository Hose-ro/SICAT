import { create } from 'zustand'
import api from '../api/axios'

export const useAsistenciaStore = create((set) => ({
  listaActual: [],
  resumen: [],
  misAsistencias: [],
  loading: false,
  error: null,

  pasarLista: async (claseSesionId, registros) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/asistencias/pasar-lista', { claseSesionId, registros })
      return res.data
    } catch (err) {
      set({ error: err.response?.data?.message || 'Error al pasar lista' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  obtenerListaSesion: async (id) => {
    set({ loading: true })
    try {
      const res = await api.get(`/asistencias/sesion/${id}`)
      set({ listaActual: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerResumen: async (materiaId, unidad) => {
    set({ loading: true })
    try {
      const params = unidad ? `?unidad=${unidad}` : ''
      const res = await api.get(`/asistencias/materia/${materiaId}${params}`)
      set({ resumen: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerMisAsistencias: async (materiaId) => {
    set({ loading: true })
    try {
      const res = await api.get(`/asistencias/mis-asistencias/${materiaId}`)
      set({ misAsistencias: res.data })
    } finally {
      set({ loading: false })
    }
  },

  justificar: async (id, justificacion, archivo) => {
    const formData = new FormData()
    formData.append('justificacion', justificacion)
    if (archivo) formData.append('archivo', archivo)
    const res = await api.post(`/asistencias/${id}/justificar`, formData)
    return res.data
  },

  exportar: async (materiaId, formato = 'excel', unidad) => {
    const params = new URLSearchParams({ formato })
    if (unidad) params.append('unidad', unidad)
    const res = await api.get(`/asistencias/exportar/${materiaId}?${params}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencias.${formato === 'pdf' ? 'pdf' : 'xlsx'}`
    a.click()
    URL.revokeObjectURL(url)
  },
}))
