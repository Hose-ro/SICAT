import { useCallback, useEffect, useState } from 'react'
import { useCalificacionStore } from '@/store/calificacionStore'

function mensajeError(error) {
  if (error.response?.status === 404) return 'El servidor todavía no tiene los criterios de evaluación.'
  return error.response?.data?.message || 'No se pudieron cargar los criterios.'
}

/**
 * Criterios de evaluación de una clase (materia + grupo). Sin grupo no hay
 * criterios: cada grupo tiene los suyos.
 */
export default function useCriterios(materiaId, grupoId, { activo = true } = {}) {
  const obtenerCriterios = useCalificacionStore((state) => state.obtenerCriterios)
  const clave = activo && materiaId && grupoId ? `${materiaId}:${grupoId}` : null
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState({ clave: null, version: -1, datos: null, error: '' })

  useEffect(() => {
    if (!clave) return undefined
    let vigente = true
    obtenerCriterios(materiaId, grupoId)
      .then((datos) => { if (vigente) setResultado({ clave, version, datos, error: '' }) })
      .catch((error) => { if (vigente) setResultado({ clave, version, datos: null, error: mensajeError(error) }) })
    return () => { vigente = false }
  }, [clave, grupoId, materiaId, obtenerCriterios, version])

  const recargar = useCallback(() => setVersion((actual) => actual + 1), [])
  const setDatos = useCallback(
    (datos) => setResultado({ clave, version, datos, error: '' }),
    [clave, version],
  )

  const deEstaClase = resultado.clave === clave
  return {
    datos: deEstaClase ? resultado.datos : null,
    error: deEstaClase ? resultado.error : '',
    cargando: Boolean(clave) && (!deEstaClase || resultado.version !== version),
    recargar,
    setDatos,
  }
}
