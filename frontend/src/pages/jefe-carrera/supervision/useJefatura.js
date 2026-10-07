import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { create } from 'zustand'
import api from '@/api/axios'

const CARRERA_RECORDADA = 'sicat.jefatura.carrera'
const ACTUALIZACION_MS = 120000

function leerCarrera() {
  try { return localStorage.getItem(CARRERA_RECORDADA) ?? '' } catch { return '' }
}
function recordarCarrera(id) {
  try { localStorage.setItem(CARRERA_RECORDADA, id) } catch { /* sin almacenamiento */ }
}

const mensaje = (error, fallback) => {
  const value = error?.response?.data?.message
  return Array.isArray(value) ? value.join('. ') : value ?? fallback
}

export const useJefaturaStore = create((set, get) => ({
  contexto: null,
  contextoError: '',
  contextoCargando: false,
  resumenes: {},

  cargarContexto: async () => {
    if (get().contextoCargando) return
    set({ contextoCargando: true, contextoError: '' })
    try {
      const { data } = await api.get('/jefe-carrera/contexto')
      set({ contexto: data })
    } catch (error) {
      set({ contextoError: mensaje(error, 'No se pudo cargar tu jefatura') })
    } finally {
      set({ contextoCargando: false })
    }
  },

  cargarResumen: async (carreraId, periodo) => {
    const key = `${carreraId}|${periodo}`
    const previo = get().resumenes[key]
    if (previo?.cargando) return
    const actualizar = (patch) => set((state) => ({ resumenes: { ...state.resumenes, [key]: { ...state.resumenes[key], ...patch } } }))
    actualizar({ cargando: true })
    try {
      const { data } = await api.get('/jefe-carrera/supervision', { params: { carreraId, periodo } })
      actualizar({ data, error: '', cargando: false, actualizado: Date.now() })
    } catch (error) {
      // Los últimos datos se conservan y se marcan como desactualizados.
      actualizar({ error: mensaje(error, 'No se pudo actualizar la información'), cargando: false, status: error?.response?.status })
    }
  },
}))

/** Carrera y periodo de la jefatura, siempre explícitos y reflejados en la URL. */
export function useJefatura() {
  const [params, setParams] = useSearchParams()
  const contexto = useJefaturaStore((s) => s.contexto)
  const contextoError = useJefaturaStore((s) => s.contextoError)
  const cargarContexto = useJefaturaStore((s) => s.cargarContexto)

  useEffect(() => { if (!contexto) cargarContexto() }, [contexto, cargarContexto])

  const carreras = useMemo(() => contexto?.carreras ?? [], [contexto])
  const valida = (id) => carreras.some((c) => String(c.id) === id)
  const pedida = params.get('carrera') ?? ''
  const recordada = leerCarrera()
  const carreraId = valida(pedida) ? pedida
    : valida(recordada) ? recordada
      : carreras.length === 1 ? String(carreras[0].id) : ''
  const periodoPedido = params.get('periodo')
  const periodo = contexto?.periodos?.includes(periodoPedido) ? periodoPedido : contexto?.periodoActual ?? ''

  useEffect(() => {
    if (!contexto || !carreraId) return
    if (params.get('carrera') === carreraId && params.get('periodo') === periodo) return
    const next = new URLSearchParams(params)
    next.set('carrera', carreraId)
    next.set('periodo', periodo)
    setParams(next, { replace: true })
  }, [contexto, carreraId, periodo, params, setParams])

  const setCarrera = useCallback((id) => {
    recordarCarrera(String(id))
    const next = new URLSearchParams(params)
    next.set('carrera', String(id))
    setParams(next)
  }, [params, setParams])

  const setPeriodo = useCallback((value) => {
    const next = new URLSearchParams(params)
    next.set('periodo', value)
    setParams(next)
  }, [params, setParams])

  /** Enlace a otra vista conservando carrera y periodo. */
  const to = useCallback((path, extra = {}) => {
    const query = new URLSearchParams({ carrera: carreraId, periodo })
    Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.set(k, String(v)) })
    return `${path}?${query}`
  }, [carreraId, periodo])

  return {
    cargando: !contexto && !contextoError,
    error: contextoError,
    reintentar: cargarContexto,
    carreras,
    carrera: carreras.find((c) => String(c.id) === carreraId) ?? null,
    carreraId,
    periodo,
    periodos: contexto?.periodos ?? [],
    periodoActual: contexto?.periodoActual ?? '',
    historico: Boolean(periodo && contexto && periodo !== contexto.periodoActual),
    setCarrera,
    setPeriodo,
    to,
  }
}

/** Resumen del periodo con actualización silenciosa; un error conserva los últimos datos. */
export function useResumen({ carreraId, periodo }) {
  const key = `${carreraId}|${periodo}`
  const entry = useJefaturaStore((s) => s.resumenes[key])
  const cargar = useJefaturaStore((s) => s.cargarResumen)

  useEffect(() => {
    if (!carreraId || !periodo) return undefined
    cargar(carreraId, periodo)
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') cargar(carreraId, periodo)
    }, ACTUALIZACION_MS)
    return () => clearInterval(id)
  }, [carreraId, periodo, cargar])

  return {
    data: entry?.data ?? null,
    cargando: Boolean(carreraId && periodo) && !entry?.data && !entry?.error,
    actualizando: Boolean(entry?.cargando && entry?.data),
    error: entry?.error ?? '',
    denegado: entry?.status === 403,
    actualizado: entry?.actualizado ?? null,
    reintentar: () => cargar(carreraId, periodo),
  }
}

export { mensaje as mensajeError }
