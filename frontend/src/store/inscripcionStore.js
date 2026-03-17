import { create } from 'zustand'
import api from '../api/axios'

export const useInscripcionStore = create((set) => ({
  misSolicitudes: [],
  pendientesDocente: [],
  misMaterias: [],
  alumnosMateria: [],
  loading: false,
  error: null,

  solicitar: async (materiaId, periodo) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/inscripciones/solicitar', { materiaId, periodo })
      return res.data
    } catch (err) {
      set({ error: err.response?.data?.message || 'Error al solicitar' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  obtenerMisSolicitudes: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/inscripciones/mis-solicitudes')
      set({ misSolicitudes: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerPendientes: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/inscripciones/pendientes')
      set({ pendientesDocente: res.data })
    } finally {
      set({ loading: false })
    }
  },

  aceptar: async (id) => {
    await api.patch(`/inscripciones/${id}/aceptar`)
    set((state) => ({
      pendientesDocente: state.pendientesDocente.filter((p) => p.id !== id),
    }))
  },

  rechazar: async (id) => {
    await api.patch(`/inscripciones/${id}/rechazar`)
    set((state) => ({
      pendientesDocente: state.pendientesDocente.filter((p) => p.id !== id),
    }))
  },

  obtenerMisMaterias: async (periodo) => {
    set({ loading: true })
    try {
      const params = periodo ? `?periodo=${periodo}` : ''
      const res = await api.get(`/inscripciones/mis-materias${params}`)
      set({ misMaterias: res.data })
    } finally {
      set({ loading: false })
    }
  },

  obtenerAlumnos: async (materiaId) => {
    set({ loading: true })
    try {
      const res = await api.get(`/inscripciones/alumnos/${materiaId}`)
      set({ alumnosMateria: res.data })
    } finally {
      set({ loading: false })
    }
  },
}))
