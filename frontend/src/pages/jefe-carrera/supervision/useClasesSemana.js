import { useCallback, useEffect, useState } from 'react'
import api from '@/api/axios'
import { sumarDias } from './formato'
import { mensajeError } from './useJefatura'

// Caché de semanas ya consultadas: volver a una fecha o a una vista es inmediato.
const cache = new Map()
const VIGENCIA_MS = 60000
const pendientes = new Map()

function pedir({ carreraId, periodo, desde, hasta, grupoId, docenteId }) {
  const key = [carreraId, periodo, desde, hasta, grupoId ?? '', docenteId ?? ''].join('|')
  const vigente = cache.get(key)
  if (vigente && Date.now() - vigente.at < VIGENCIA_MS) return { key, promise: Promise.resolve(vigente.data) }
  if (!pendientes.has(key)) {
    const promise = api
      .get('/jefe-carrera/calendario', { params: { carreraId, periodo, desde, hasta, grupoId, docenteId } })
      .then(({ data }) => { cache.set(key, { data, at: Date.now() }); return data })
      .finally(() => pendientes.delete(key))
    pendientes.set(key, promise)
  }
  return { key, promise: pendientes.get(key) }
}

/** Clases esperadas de un intervalo, con su estado de registro. */
export function useClases({ carreraId, periodo, desde, hasta, grupoId, docenteId, prefetch = 0 }) {
  const key = [carreraId, periodo, desde, hasta, grupoId ?? '', docenteId ?? ''].join('|')
  const [estado, setEstado] = useState({})
  const [intento, setIntento] = useState(0)
  const activo = Boolean(carreraId && periodo && desde && hasta)

  useEffect(() => {
    if (!activo) return undefined
    let vivo = true
    const { promise } = pedir({ carreraId, periodo, desde, hasta, grupoId, docenteId })
    promise
      .then((data) => {
        if (!vivo) return
        setEstado((s) => ({ ...s, [key]: { data, error: '' } }))
        // Semanas vecinas en segundo plano: navegar no espera a la red.
        for (let i = 1; i <= prefetch; i++) {
          for (const paso of [7 * i, -7 * i]) {
            pedir({ carreraId, periodo, desde: sumarDias(desde, paso), hasta: sumarDias(hasta, paso), grupoId, docenteId }).promise.catch(() => {})
          }
        }
      })
      .catch((error) => { if (vivo) setEstado((s) => ({ ...s, [key]: { ...s[key], error: mensajeError(error, 'No se pudo consultar el horario') } })) })
    return () => { vivo = false }
  }, [activo, key, carreraId, periodo, desde, hasta, grupoId, docenteId, prefetch, intento])

  const entry = estado[key] ?? (cache.has(key) ? { data: cache.get(key).data } : null)
  const reintentar = useCallback(() => { cache.delete(key); setEstado((s) => ({ ...s, [key]: undefined })); setIntento((n) => n + 1) }, [key])
  return { clases: entry?.data ?? null, error: entry?.error ?? '', cargando: activo && !entry?.data && !entry?.error, reintentar }
}
