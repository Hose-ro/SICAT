import { create } from 'zustand'
import api from '../api/axios'

export const useGrupoStore = create((set, get) => ({
  grupos: [],
  grupoActivo: null,
  filtros: { carreraId: undefined, semestre: undefined, periodo: undefined },
  loading: false,
  error: null,

  cargarGrupos: async (filtros) => {
    set({ loading: true, error: null })
    const params = {}
    const f = filtros ?? get().filtros
    if (f.carreraId) params.carreraId = f.carreraId
    if (f.semestre) params.semestre = f.semestre
    if (f.periodo) params.periodo = f.periodo
    try {
      const res = await api.get('/grupos', { params })
      set({ grupos: res.data, loading: false })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar grupos', loading: false })
    }
  },

  crearGrupo: async (data) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/grupos', data)
      await get().cargarGrupos()
      return res.data
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al crear grupo'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  editarGrupo: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await api.patch(`/grupos/${id}`, data)
      await get().cargarGrupos()
      if (get().grupoActivo?.id === id) await get().seleccionarGrupo(id)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al editar grupo'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  eliminarGrupo: async (id) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/grupos/${id}`)
      await get().cargarGrupos()
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al eliminar grupo', loading: false })
    }
  },

  seleccionarGrupo: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get(`/grupos/${id}`)
      set({ grupoActivo: res.data, loading: false })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar grupo', loading: false })
    }
  },

  asignarAlumnos: async (grupoId, alumnoIds) => {
    set({ loading: true, error: null })
    try {
      await api.post(`/grupos/${grupoId}/alumnos`, { alumnoIds })
      await get().seleccionarGrupo(grupoId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al asignar alumnos'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  quitarAlumno: async (grupoId, alumnoId) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/grupos/${grupoId}/alumnos/${alumnoId}`)
      await get().seleccionarGrupo(grupoId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al quitar alumno'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  agregarMaterias: async (grupoId, materiaIds) => {
    set({ loading: true, error: null })
    try {
      await api.post(`/grupos/${grupoId}/materias`, { materiaIds })
      await get().seleccionarGrupo(grupoId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al agregar materias'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  quitarMateria: async (grupoId, materiaId) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/grupos/${grupoId}/materias/${materiaId}`)
      await get().seleccionarGrupo(grupoId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al quitar materia'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  cargarHorario: async (grupoId) => {
    try {
      const res = await api.get(`/grupos/${grupoId}/horario`)
      return res.data
    } catch (e) {
      return null
    }
  },

  setFiltros: async (filtros) => {
    set({ filtros })
    await get().cargarGrupos(filtros)
  },

  clearError: () => set({ error: null }),
}))
