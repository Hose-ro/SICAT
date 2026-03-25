import { create } from 'zustand'
import api from '../api/axios'

function getErrorMessage(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join(', ')
  return message || fallback
}

function appendFormData(fd, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      fd.append(key, JSON.stringify(value))
      return
    }
    if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value))
      return
    }
    fd.append(key, value)
  })
  return fd
}

function buildTaskFormData(dto, archivos = []) {
  const fd = appendFormData(new FormData(), dto)
  archivos.forEach((archivo) => fd.append('archivos', archivo))
  return fd
}

async function downloadBinary(url, filename, params) {
  const response = await api.get(url, {
    params,
    responseType: 'blob',
  })
  const blobUrl = window.URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(blobUrl)
}

async function downloadBinaryPost(url, body, filename) {
  const response = await api.post(url, body, {
    responseType: 'blob',
  })
  const blobUrl = window.URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export const useTareaStore = create((set, get) => ({
  tareas: [],
  taskStats: null,
  tareaActiva: null,
  entregas: [],
  entregasStats: null,
  studentTasks: [],
  misEntregas: [],
  reportData: null,
  loading: false,
  saving: false,
  error: null,

  clearError: () => set({ error: null }),

  crear: async (dto, archivos = []) => {
    set({ saving: true, error: null })
    try {
      const res = await api.post('/tareas', buildTaskFormData(dto, archivos))
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al crear tarea')
      set({ error: message })
      throw error
    } finally {
      set({ saving: false })
    }
  },

  editar: async (id, dto, archivos = []) => {
    set({ saving: true, error: null })
    try {
      const res = await api.patch(`/tareas/${id}`, buildTaskFormData(dto, archivos))
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al editar tarea')
      set({ error: message })
      throw error
    } finally {
      set({ saving: false })
    }
  },

  publicar: async (id) => {
    const res = await api.patch(`/tareas/${id}/publicar`)
    return res.data
  },

  cerrar: async (id) => {
    const res = await api.patch(`/tareas/${id}/cerrar`)
    return res.data
  },

  reabrir: async (id) => {
    const res = await api.patch(`/tareas/${id}/reabrir`)
    return res.data
  },

  desactivar: async (id) => {
    const res = await api.delete(`/tareas/${id}`)
    return res.data
  },

  obtenerDocente: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/tareas/docente', { params: filters })
      set({
        tareas: res.data.items || [],
        taskStats: res.data.stats || null,
      })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al cargar tareas')
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerPorMateria: async (materiaId) => {
    const data = await get().obtenerDocente({ materiaId })
    return data.items || []
  },

  obtenerDetalle: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get(`/tareas/${id}`)
      set({ tareaActiva: res.data })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al cargar detalle de tarea')
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  obtenerEntregas: async (tareaId, filters = {}) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get(`/tareas/${tareaId}/entregas`, { params: filters })
      set({
        entregas: res.data.entregas || [],
        entregasStats: res.data.stats || null,
        tareaActiva: res.data.tarea || get().tareaActiva,
      })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al cargar entregas')
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  revisar: async (entregaId, observacion) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/revisar`, { observacion })
    return res.data
  },

  revisarMasivo: async (tareaId, entregaIds, observacion) => {
    const res = await api.patch('/tareas/entregas/masivo/revisar', { entregaIds, observacion }, {
      params: { tareaId },
    })
    return res.data
  },

  calificar: async (entregaId, payload) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/calificar`, payload)
    return res.data
  },

  marcarIncorrecta: async (entregaId, observacion) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/incorrecta`, { observacion })
    return res.data
  },

  devolverParaCorreccion: async (entregaId, observacion, permiteCorreccion = true) => {
    const res = await api.patch(`/tareas/entregas/${entregaId}/devolver`, { observacion, permiteCorreccion })
    return res.data
  },

  marcarPresencial: async (tareaId, alumnoId) => {
    const res = await api.post(`/tareas/${tareaId}/marcar-entrega-presencial`, { alumnoId })
    return res.data
  },

  obtenerMisTareas: async (materiaId) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/tareas/mis-tareas', {
        params: materiaId ? { materiaId } : {},
      })
      set({
        studentTasks: res.data || [],
        misEntregas: res.data || [],
      })
      return res.data
    } catch (error) {
      const message = getErrorMessage(error, 'Error al cargar tus tareas')
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  entregar: async (id, payload = {}, archivos = []) => {
    const res = await api.post(`/tareas/${id}/entregar`, buildTaskFormData(payload, archivos))
    return res.data
  },

  editarMiEntrega: async (id, payload = {}, archivos = []) => {
    const res = await api.patch(`/tareas/${id}/mi-entrega`, buildTaskFormData(payload, archivos))
    return res.data
  },

  obtenerReporte: async (filters = {}) => {
    const res = await api.get('/tareas/reportes', { params: filters })
    set({ reportData: res.data })
    return res.data
  },

  exportarReporte: async (filters = {}, formato = 'excel') => {
    await downloadBinary('/tareas/exportar', formato === 'pdf' ? 'tareas.pdf' : 'tareas.xlsx', {
      ...filters,
      formato,
    })
  },

  exportarTarea: async (id, formato = 'excel') => {
    await downloadBinary(`/tareas/${id}/exportar`, formato === 'pdf' ? `tarea-${id}.pdf` : `tarea-${id}.xlsx`, { formato })
  },

  descargarEntregas: async (id, entregaIds = []) => {
    await downloadBinaryPost(`/tareas/${id}/descargar-entregas`, { entregaIds }, `tarea-${id}-evidencias.zip`)
  },

  descargarCierreUnidad: async (unidadId) => {
    await downloadBinary(`/tareas/unidad/${unidadId}/descargar`, `cierre-unidad-${unidadId}.zip`)
  },
}))
