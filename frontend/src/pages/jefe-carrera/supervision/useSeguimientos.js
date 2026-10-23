import { useCallback, useEffect, useMemo } from 'react'
import { create } from 'zustand'
import api from '@/api/axios'
import { mensajeError } from './useJefatura'
import { hoyClave } from './formato'

/**
 * Un caso se identifica igual que en el backend (leerHuella): una clase en una
 * fecha, un alumno, una materia en un grupo o un docente.
 */
export function claveCaso(caso) {
  if (!caso) return ''
  switch (caso.tipo) {
    case 'ASISTENCIA_SIN_CAPTURA': return `A:${caso.horarioId}:${caso.fecha}`
    case 'ALUMNO_RIESGO': return `R:${caso.alumnoId}`
    case 'CALIFICACIONES_PENDIENTES': return `C:${caso.materiaId}:${caso.grupoId}`
    case 'SEGUIMIENTO_DOCENTE': return `D:${caso.docenteId}`
    default: return ''
  }
}

export const TIPOS_SEGUIMIENTO = {
  ASISTENCIA_SIN_CAPTURA: 'Listas sin captura',
  ALUMNO_RIESGO: 'Alumnos en riesgo',
  CALIFICACIONES_PENDIENTES: 'Calificaciones pendientes',
  SEGUIMIENTO_DOCENTE: 'Docentes',
}

/** Para hoy: abierto y con fecha de revisión hoy o ya pasada. */
export const esParaHoy = (s) => s.abierto && s.fechaRevision != null && s.fechaRevision <= hoyClave()

export const useSeguimientosStore = create((set, get) => ({
  listas: {},
  cargar: async (carreraId, periodo) => {
    const key = `${carreraId}|${periodo}`
    if (get().listas[key]?.cargando) return
    const actualizar = (patch) => set((state) => ({ listas: { ...state.listas, [key]: { ...state.listas[key], ...patch } } }))
    actualizar({ cargando: true })
    try {
      const { data } = await api.get('/jefe-carrera/seguimientos', { params: { carreraId, periodo } })
      actualizar({ data, error: '', cargando: false })
    } catch (error) {
      actualizar({ error: mensajeError(error, 'No se pudieron cargar las observaciones'), cargando: false })
    }
  },
  guardar: (carreraId, periodo, seguimiento) => {
    const key = `${carreraId}|${periodo}`
    set((state) => {
      const previos = state.listas[key]?.data ?? []
      const data = [seguimiento, ...previos.filter((s) => s.id !== seguimiento.id)]
      return { listas: { ...state.listas, [key]: { ...state.listas[key], data, error: '' } } }
    })
  },
}))

/** Seguimientos del periodo, compartidos entre Inicio, el detalle de clase y la vista de seguimientos. */
export function useSeguimientos({ carreraId, periodo }) {
  const key = `${carreraId}|${periodo}`
  const entry = useSeguimientosStore((s) => s.listas[key])
  const cargar = useSeguimientosStore((s) => s.cargar)
  const guardar = useSeguimientosStore((s) => s.guardar)

  useEffect(() => {
    if (carreraId && periodo && !entry) cargar(carreraId, periodo)
  }, [carreraId, periodo, entry, cargar])

  const lista = useMemo(() => entry?.data ?? [], [entry])
  const porCaso = useMemo(() => new Map(lista.filter((s) => s.referencia).map((s) => [claveCaso(s.referencia), s])), [lista])

  /** Registra una nota; devuelve el seguimiento actualizado o lanza el mensaje del servidor. */
  const registrar = useCallback(async (payload) => {
    try {
      const { data } = await api.post('/jefe-carrera/seguimientos', payload, { params: { carreraId, periodo } })
      guardar(carreraId, periodo, data)
      return data
    } catch (error) {
      throw new Error(mensajeError(error, 'No se pudo guardar la nota'), { cause: error })
    }
  }, [carreraId, periodo, guardar])

  return {
    lista,
    cargando: Boolean(carreraId && periodo) && !entry?.data && !entry?.error,
    error: entry?.error ?? '',
    reintentar: () => cargar(carreraId, periodo),
    buscar: (caso) => porCaso.get(claveCaso(caso)) ?? null,
    registrar,
  }
}
