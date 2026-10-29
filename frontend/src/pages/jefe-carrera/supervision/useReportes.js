import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import api from '@/api/axios'
import { mensajeError } from './useJefatura'

// Reporte de una oferta (materia + grupo): el mismo cálculo de calificaciones
// del docente, en consulta. Se guarda por carrera y periodo.
const cache = new Map()

function pedir({ carreraId, periodo }, materiaId, grupoId) {
  const key = `${carreraId}|${periodo}|${materiaId}:${grupoId}`
  const vigente = cache.get(key)
  if (vigente && (vigente.pending || Date.now() - vigente.at < 60000)) return vigente.promise
  const promise = api.get(`/jefe-carrera/ofertas/${materiaId}/grupos/${grupoId}`, { params: { carreraId, periodo } }).then(({ data }) => data)
  const entry = { promise, pending: true, at: Date.now() }
  cache.set(key, entry)
  promise.then(() => { entry.pending = false; entry.at = Date.now() }, () => cache.delete(key))
  return promise
}

/** Tras una incorporación, el reporte de la oferta debe volver a pedirse. */
let version = 0
const oyentes = new Set()
const suscribir = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn) }
const avisar = () => { version += 1; oyentes.forEach((fn) => fn()) }
export function invalidarReportes() {
  cache.clear()
  avisar()
}
/** Vuelve a pedir solo lo que falló: un error nunca queda en caché. */
export const reintentarReportes = avisar

/**
 * Estado conjunto de varios reportes: un cálculo que reúne materias solo es
 * completo cuando todas respondieron. Nunca se lee un error como «sin señales».
 */
export function estadoConjunto(reportes, claves) {
  const estados = claves.map((clave) => reportes[clave] ?? { cargando: true })
  const fallidos = estados.filter((e) => e.error).length
  return {
    cargando: estados.some((e) => e.cargando),
    fallidos,
    completo: estados.every((e) => e.data),
    parcial: fallidos > 0 && estados.some((e) => e.data),
    error: estados.find((e) => e.error)?.error ?? '',
  }
}

/** Reportes de varias ofertas; devuelve un mapa `materiaId:grupoId` → { data | error }. */
export function useReportes(j, pares) {
  const claves = useMemo(() => [...new Set(pares.map((p) => `${p.materiaId}:${p.grupoId}`))].sort(), [pares])
  const firma = claves.join(',')
  const [estado, setEstado] = useState({})

  const { carreraId, periodo } = j
  const vigencia = useSyncExternalStore(suscribir, () => version)
  useEffect(() => {
    if (!carreraId || !periodo || !firma) return undefined
    let vivo = true
    firma.split(',').forEach((clave) => {
      const [materiaId, grupoId] = clave.split(':')
      const key = `${carreraId}|${periodo}|${clave}`
      pedir({ carreraId, periodo }, materiaId, grupoId)
        .then((data) => { if (vivo) setEstado((s) => (s[key]?.data === data ? s : { ...s, [key]: { data } })) })
        .catch((error) => { if (vivo) setEstado((s) => ({ ...s, [key]: { error: mensajeError(error, 'No se pudo consultar la oferta') } })) })
      // Un reintento muestra «Cargando» en lugar del error anterior.
      setEstado((s) => (s[key]?.error ? { ...s, [key]: { cargando: true } } : s))
    })
    return () => { vivo = false }
  }, [carreraId, periodo, firma, vigencia])

  return useMemo(() => Object.fromEntries(claves.map((clave) => [clave, estado[`${carreraId}|${periodo}|${clave}`] ?? { cargando: true }])), [claves, estado, carreraId, periodo])
}

export { resumenAlumno } from '@/lib/resumenFilas'
