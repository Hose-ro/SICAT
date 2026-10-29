import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useJefaturaStore } from './useJefatura'
import { invalidarClases } from './useClasesSemana'
import { invalidarReportes } from './useReportes'
import { useSeguimientosStore } from './useSeguimientos'

/** Al volver a la pestaña tras este tiempo, todo se refresca a la vez. */
const VOLVER_MS = 60000

/**
 * Refresca juntas todas las fuentes de una vista de jefatura: resumen, clases,
 * reportes por materia y seguimientos. Así una pantalla abierta no mezcla un
 * resumen nuevo con clases o notas de antes.
 */
export function actualizarJefatura(carreraId, periodo, { manual = false } = {}) {
  if (!carreraId || !periodo) return
  invalidarClases()
  invalidarReportes()
  useSeguimientosStore.getState().cargar(carreraId, periodo)
  useJefaturaStore.getState().cargarResumen(carreraId, periodo, { manual })
}

/** Al recuperar el foco con datos de hace más de un minuto, actualiza todo en silencio. */
export function useActualizarAlVolver(carreraId, periodo) {
  useEffect(() => {
    if (!carreraId || !periodo) return undefined
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      const actualizado = useJefaturaStore.getState().resumenes[`${carreraId}|${periodo}`]?.actualizado ?? 0
      if (Date.now() - actualizado > VOLVER_MS) actualizarJefatura(carreraId, periodo)
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [carreraId, periodo])
}

// Las cachés de jefatura viven en memoria: al cerrar sesión o cambiar de cuenta no deben verse los datos de otra persona.
let usuarioPrevio = useAuthStore.getState().user?.id ?? null
useAuthStore.subscribe((state) => {
  const usuario = state.user?.id ?? null
  if (usuario === usuarioPrevio) return
  usuarioPrevio = usuario
  useJefaturaStore.getState().limpiar()
  useSeguimientosStore.setState({ listas: {} })
  invalidarClases()
  invalidarReportes()
})
