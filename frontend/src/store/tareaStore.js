import { create } from 'zustand'
import api from '../api/axios'

export const useTareaStore = create((set, get) => ({
  tareas: [],
  tareaActiva: null,
  entregas: [],
  misEntregas: [],
  loading: false,
  error: null,

  crear: async (dto, archivo) => {
    set({ loading: true, error: null })
    try {
      let res
      if (archivo) {
        const fd = new FormData()
        Object.entries(dto).forEach(([k, v]) => fd.append(k, v))
        fd.append('archivo', archivo)
        res = await api.post('/tareas', fd)
      } else {
        res = await api.post('/tareas', dto)
      }
      return res.data
    } catch (err) {
      set({ error: err.response?.data?.message || 'Error al crear tarea' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  obtenerPorMateria: async (materiaId) => {
    set({ loading: true })
    try {
      const res = await api.get(`/tareas/materia/${materiaId}`)
      set({ tareas: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerDetalle: async (id) => {
    const res = await api.get(`/tareas/${id}`)
    set({ tareaActiva: res.data })
    return res.data
  },

  editar: async (id, dto) => {
    const res = await api.patch(`/tareas/${id}`, dto)
    return res.data
  },

  desactivar: async (id) => {
    await api.delete(`/tareas/${id}`)
    set((state) => ({ tareas: state.tareas.filter((t) => t.id !== id) }))
  },

  entregar: async (id, archivo, firma, comentario) => {
    const fd = new FormData()
    if (archivo) fd.append('archivo', archivo)
    if (firma) fd.append('archivo', firma)
    if (comentario) fd.append('comentario', comentario)
    const res = await api.post(`/tareas/${id}/entregar`, fd)
    return res.data
  },

  obtenerMisTareas: async (materiaId) => {
    set({ loading: true })
    try {
      const res = await api.get(`/tareas/mis-tareas/${materiaId}`)
      set({ misEntregas: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerEntregas: async (tareaId) => {
    set({ loading: true })
    try {
      const res = await api.get(`/tareas/${tareaId}/entregas`)
      set({ entregas: res.data.entregas || res.data })
    } finally {
      set({ loading: false })
    }
  },

  revisar: async (entregaId, observacion) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/revisar`, { observacion })
    return res.data
  },

  calificar: async (entregaId, calificacion, observacion) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/calificar`, { calificacion, observacion })
    return res.data
  },

  marcarIncorrecta: async (entregaId, observacion) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/incorrecta`, { observacion })
    return res.data
  },

  marcarPresencial: async (tareaId, alumnoId) => {
    const res = await api.post(`/tareas/${tareaId}/marcar-entrega-presencial`, { alumnoId })
    return res.data
  },
}))
