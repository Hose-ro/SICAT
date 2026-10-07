import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import api from '@/api/axios'
import { promedio, tipoCalificacion } from './formato'
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
export function invalidarReportes() {
  cache.clear()
  version += 1
  oyentes.forEach((fn) => fn())
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
    })
    return () => { vivo = false }
  }, [carreraId, periodo, firma, vigencia])

  return useMemo(() => Object.fromEntries(claves.map((clave) => [clave, estado[`${carreraId}|${periodo}|${clave}`] ?? { cargando: true }])), [claves, estado, carreraId, periodo])
}

/** Filas (alumno × unidad) de un alumno en un reporte, resumidas con las reglas de SICAT. */
export function resumenAlumno(rows) {
  const notas = rows.map((r) => r.calificacionFinal)
  const tipos = rows.map(tipoCalificacion)
  const asistencia = rows.reduce((a, r) => ({
    registradas: a.registradas + (r.asistencia?.registradas ?? 0),
    asistencias: a.asistencias + (r.asistencia?.asistencias ?? 0),
    faltas: a.faltas + (r.asistencia?.faltas ?? 0),
    retardos: a.retardos + (r.asistencia?.retardos ?? 0),
    justificadas: a.justificadas + (r.asistencia?.justificadas ?? 0),
  }), { registradas: 0, asistencias: 0, faltas: 0, retardos: 0, justificadas: 0 })
  const valor = promedio(notas)
  return {
    promedio: valor,
    tipo: valor == null ? 'SIN_CAPTURA' : tipos.every((t) => t === 'REAL') ? 'REAL' : 'PROVISIONAL',
    calificadas: tipos.filter((t) => t !== 'SIN_CAPTURA').length,
    unidades: rows.length,
    asistencia: { ...asistencia, porcentaje: asistencia.registradas ? Math.round((asistencia.asistencias / asistencia.registradas) * 100) : null },
    motivos: [...new Set(rows.flatMap((r) => r.motivos ?? []))],
    observaciones: rows.filter((r) => r.observacionManual).map((r) => ({ unidad: r.unidad?.nombre, texto: r.observacionManual })),
  }
}
