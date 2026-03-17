import { create } from 'zustand'
import api from '../api/axios'

export const useAcademiaStore = create((set, get) => ({
  academias: [],
  academiaActiva: null,
  loading: false,
  error: null,

  cargarAcademias: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/academias')
      set({ academias: res.data, loading: false })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar academias', loading: false })
    }
  },

  crearAcademia: async (data) => {
    set({ loading: true, error: null })
    try {
      await api.post('/academias', data)
      await get().cargarAcademias()
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al crear academia'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  editarAcademia: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await api.patch(`/academias/${id}`, data)
      await get().cargarAcademias()
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al editar academia'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  eliminarAcademia: async (id) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/academias/${id}`)
      await get().cargarAcademias()
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al eliminar academia', loading: false })
    }
  },

  seleccionarAcademia: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get(`/academias/${id}`)
      set({ academiaActiva: res.data, loading: false })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar academia', loading: false })
    }
  },

  asignarDocentes: async (academiaId, docenteIds) => {
    set({ loading: true, error: null })
    try {
      await api.post(`/academias/${academiaId}/docentes`, { docenteIds })
      await get().seleccionarAcademia(academiaId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al asignar docentes'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  quitarDocente: async (academiaId, docenteId) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/academias/${academiaId}/docentes/${docenteId}`)
      await get().seleccionarAcademia(academiaId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al quitar docente'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  asignarMaterias: async (academiaId, materiaIds) => {
    set({ loading: true, error: null })
    try {
      await api.post(`/academias/${academiaId}/materias`, { materiaIds })
      await get().seleccionarAcademia(academiaId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al asignar materias'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  quitarMateria: async (academiaId, materiaId) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/academias/${academiaId}/materias/${materiaId}`)
      await get().seleccionarAcademia(academiaId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al quitar materia'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  clearError: () => set({ error: null }),
}))
