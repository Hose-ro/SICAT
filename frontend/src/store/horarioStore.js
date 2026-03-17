import { create } from 'zustand'
import api from '../api/axios'

export const useHorarioStore = create((set, get) => ({
  docenteSeleccionado: null,
  grupoSeleccionado: null,
  grupos: [],
  materias: [],
  materiasSinDocente: [],
  materiasSinAula: [],
  aulas: [],
  ocupacionDocente: [],
  loading: false,
  error: null,

  seleccionarDocente: async (docenteId) => {
    set({ loading: true, error: null })
    try {
      const [horarioRes, sinDocenteRes] = await Promise.all([
        api.get(`/horarios/docente/${docenteId}`),
        api.get('/horarios/sin-docente'),
      ])
      set({
        docenteSeleccionado: horarioRes.data.docente,
        grupoSeleccionado: null,
        materias: horarioRes.data.materias,
        materiasSinDocente: sinDocenteRes.data,
        loading: false,
      })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar horario', loading: false })
    }
  },

  seleccionarGrupo: async (grupoId) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get(`/grupos/${grupoId}/horario`)
      set({
        grupoSeleccionado: res.data,
        docenteSeleccionado: null,
        materias: res.data.materias,
        loading: false,
      })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar horario', loading: false })
    }
  },

  cargarGrupos: async (filtros = {}) => {
    try {
      const res = await api.get('/grupos', { params: filtros })
      set({ grupos: res.data })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar grupos' })
    }
  },

  asignarDocente: async (materiaId, docenteId) => {
    set({ loading: true, error: null })
    try {
      await api.post('/horarios/asignar-docente', { materiaId, docenteId })
      await get().seleccionarDocente(docenteId)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al asignar docente'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  quitarDocente: async (materiaId) => {
    set({ loading: true, error: null })
    const docenteId = get().docenteSeleccionado?.id
    const grupoId = get().grupoSeleccionado?.id
    try {
      await api.delete(`/horarios/quitar-docente/${materiaId}`)
      if (docenteId) await get().seleccionarDocente(docenteId)
      else if (grupoId) await get().seleccionarGrupo(grupoId)
      else set({ loading: false })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al quitar docente', loading: false })
    }
  },

  asignarAula: async (materiaId, aulaId) => {
    set({ loading: true, error: null })
    const docenteId = get().docenteSeleccionado?.id
    const grupoId = get().grupoSeleccionado?.id
    try {
      await api.post('/horarios/asignar-aula', { materiaId, aulaId })
      if (docenteId) await get().seleccionarDocente(docenteId)
      else if (grupoId) await get().seleccionarGrupo(grupoId)
      else set({ loading: false })
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al asignar aula'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  quitarAula: async (materiaId) => {
    set({ loading: true, error: null })
    const docenteId = get().docenteSeleccionado?.id
    const grupoId = get().grupoSeleccionado?.id
    try {
      await api.delete(`/horarios/quitar-aula/${materiaId}`)
      if (docenteId) await get().seleccionarDocente(docenteId)
      else if (grupoId) await get().seleccionarGrupo(grupoId)
      else set({ loading: false })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al quitar aula', loading: false })
    }
  },

  cargarAulas: async () => {
    try {
      const res = await api.get('/aulas')
      set({ aulas: res.data })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar aulas' })
    }
  },

  cargarOcupacion: async (docenteId, aulaId) => {
    try {
      const params = {}
      if (docenteId) params.docenteId = docenteId
      if (aulaId) params.aulaId = aulaId
      const res = await api.get('/horarios/ocupacion', { params })
      set({ ocupacionDocente: res.data })
    } catch (e) {
      set({ error: e.response?.data?.message || 'Error al cargar ocupación' })
    }
  },

  clearError: () => set({ error: null }),
}))
