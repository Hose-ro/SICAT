import { create } from 'zustand'
import api from '../api/axios'

function getErrorMessage(error, fallback) {
  const message = error?.response?.data?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.join(', ')
  if (typeof message?.message === 'string') return message.message
  return fallback
}

export const useHorarioStore = create((set, get) => ({
  docenteSeleccionado: null,
  grupoSeleccionado: null,
  grupos: [],
  materiasCatalogo: [],
  docentesCatalogo: [],
  horarios: [],
  aulas: [],
  loading: false,
  saving: false,
  validating: false,
  validation: { ok: true, message: '', conflicts: [] },
  error: null,

  cargarCatalogos: async () => {
    set({ error: null })
    try {
      const [materiasRes, docentesRes, gruposRes, aulasRes] = await Promise.all([
        api.get('/materias'),
        api.get('/usuarios?rol=DOCENTE'),
        api.get('/grupos'),
        api.get('/aulas'),
      ])

      set({
        materiasCatalogo: materiasRes.data,
        docentesCatalogo: docentesRes.data.filter((usuario) => usuario.rol === 'DOCENTE' && usuario.activo),
        grupos: gruposRes.data,
        aulas: aulasRes.data,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar catálogos de horarios') })
    }
  },

  cargarGrupos: async (filtros = {}) => {
    try {
      const res = await api.get('/grupos', { params: filtros })
      set({ grupos: res.data })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar grupos') })
    }
  },

  seleccionarDocente: async (docenteId) => {
    if (!docenteId) {
      set({ docenteSeleccionado: null, horarios: [], grupoSeleccionado: null })
      return
    }

    set({ loading: true, error: null })
    try {
      const res = await api.get(`/horarios/docente/${docenteId}`)
      set({
        docenteSeleccionado: res.data.docente,
        grupoSeleccionado: null,
        horarios: res.data.horarios,
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar horario del docente'), loading: false })
    }
  },

  seleccionarGrupo: async (grupoId) => {
    if (!grupoId) {
      set({ grupoSeleccionado: null, horarios: [], docenteSeleccionado: null })
      return
    }

    set({ loading: true, error: null })
    try {
      const res = await api.get(`/horarios/grupo/${grupoId}`)
      set({
        grupoSeleccionado: res.data.grupo,
        docenteSeleccionado: null,
        horarios: res.data.horarios,
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar horario del grupo'), loading: false })
    }
  },

  refrescarContexto: async () => {
    const { docenteSeleccionado, grupoSeleccionado } = get()
    if (docenteSeleccionado?.id) {
      await get().seleccionarDocente(docenteSeleccionado.id)
      return
    }
    if (grupoSeleccionado?.id) {
      await get().seleccionarGrupo(grupoSeleccionado.id)
      return
    }
    set({ horarios: [] })
  },

  crearHorario: async (payload) => {
    set({ saving: true, error: null })
    try {
      const res = await api.post('/horarios', payload)
      await get().refrescarContexto()
      set({ saving: false })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al crear horario')
      set({ error: message, saving: false })
      throw new Error(message)
    }
  },

  actualizarHorario: async (horarioId, payload) => {
    set({ saving: true, error: null })
    try {
      const res = await api.patch(`/horarios/${horarioId}`, payload)
      await get().refrescarContexto()
      set({ saving: false })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al actualizar horario')
      set({ error: message, saving: false })
      throw new Error(message)
    }
  },

  eliminarHorario: async (horarioId) => {
    set({ saving: true, error: null })
    try {
      await api.delete(`/horarios/${horarioId}`)
      await get().refrescarContexto()
      set({ saving: false })
    } catch (error) {
      const message = getErrorMessage(error, 'Error al eliminar horario')
      set({ error: message, saving: false })
      throw new Error(message)
    }
  },

  validarHorario: async (payload, horarioId) => {
    set({ validating: true, error: null })
    try {
      const res = await api.post('/horarios/validar-conflicto', {
        ...payload,
        ...(horarioId ? { horarioId } : {}),
      })
      set({ validation: res.data, validating: false })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al validar horario')
      const result = {
        ok: false,
        message,
        conflicts: error?.response?.data?.conflicts ?? [],
      }
      set({ validation: result, validating: false })
      return result
    }
  },

  clearValidation: () => set({ validation: { ok: true, message: '', conflicts: [] }, validating: false }),
  clearError: () => set({ error: null }),
}))
