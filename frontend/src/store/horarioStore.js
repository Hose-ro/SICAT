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
  /** El docente sólo ve y edita su propio horario. */
  modoPropio: false,
  grupos: [],
  materiasCatalogo: [],
  docentesCatalogo: [],
  aulasCatalogo: [],
  horarios: [],
  clases: [],
  loading: false,
  saving: false,
  validating: false,
  validation: { ok: true, message: '', conflicts: [] },
  error: null,

  /**
   * El listado de docentes es sólo para administración; un docente programa
   * para sí mismo, así que no lo pide (le daría 403 y tumbaría el resto).
   */
  cargarCatalogos: async ({ soloPropias = false } = {}) => {
    set({ error: null })
    try {
      const [materiasRes, gruposRes, aulasRes, docentesRes] = await Promise.all([
        api.get('/materias'),
        api.get('/grupos/catalogo'),
        api.get('/aulas'),
        soloPropias ? Promise.resolve({ data: [] }) : api.get('/usuarios?rol=DOCENTE'),
      ])

      set({
        materiasCatalogo: materiasRes.data,
        docentesCatalogo: docentesRes.data.filter((usuario) => usuario.rol === 'DOCENTE' && usuario.activo),
        grupos: gruposRes.data,
        aulasCatalogo: aulasRes.data,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar catálogos de horarios') })
    }
  },

  /** Horario del docente en sesión, sin pasar por los endpoints de admin. */
  cargarMiHorario: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/horarios/mis-horarios')
      set({
        modoPropio: true,
        docenteSeleccionado: res.data.docente,
        grupoSeleccionado: null,
        horarios: res.data.horarios,
        clases: res.data.clases ?? [],
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar tu horario'), loading: false })
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
      set({ docenteSeleccionado: null, horarios: [], clases: [], grupoSeleccionado: null })
      return
    }

    set({ loading: true, error: null })
    try {
      const res = await api.get(`/horarios/docente/${docenteId}`)
      set({
        docenteSeleccionado: res.data.docente,
        grupoSeleccionado: null,
        horarios: res.data.horarios,
        clases: res.data.clases ?? [],
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar horario del docente'), loading: false })
    }
  },

  seleccionarGrupo: async (grupoId) => {
    if (!grupoId) {
      set({ grupoSeleccionado: null, horarios: [], clases: [], docenteSeleccionado: null })
      return
    }

    set({ loading: true, error: null })
    try {
      const res = await api.get(`/horarios/grupo/${grupoId}`)
      set({
        grupoSeleccionado: res.data.grupo,
        docenteSeleccionado: null,
        horarios: res.data.horarios,
        clases: res.data.clases ?? [],
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Error al cargar horario del grupo'), loading: false })
    }
  },

  refrescarContexto: async () => {
    const { docenteSeleccionado, grupoSeleccionado, modoPropio } = get()
    if (modoPropio) {
      await get().cargarMiHorario()
      return
    }
    if (docenteSeleccionado?.id) {
      await get().seleccionarDocente(docenteSeleccionado.id)
      return
    }
    if (grupoSeleccionado?.id) {
      await get().seleccionarGrupo(grupoSeleccionado.id)
      return
    }
    set({ horarios: [], clases: [] })
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

  actualizarClase: async (payload) => {
    set({ saving: true, error: null })
    try {
      const res = await api.patch('/horarios/clase', payload)
      await get().refrescarContexto()
      set({ saving: false })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al actualizar la clase')
      set({ error: message, saving: false })
      throw new Error(message)
    }
  },

  eliminarClase: async (horarioIds) => {
    set({ saving: true, error: null })
    try {
      await api.delete('/horarios/clase', { data: { horarioIds } })
      await get().refrescarContexto()
      set({ saving: false })
    } catch (error) {
      const message = getErrorMessage(error, 'Error al eliminar la clase')
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

  validarHorario: async (payload, horarioIds) => {
    set({ validating: true, error: null })
    try {
      const ids = Array.isArray(horarioIds) ? horarioIds : horarioIds ? [horarioIds] : []
      const res = await api.post('/horarios/validar-conflicto', {
        ...payload,
        ...(ids.length > 0 ? { horarioIds: ids } : {}),
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
