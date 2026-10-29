import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '@/api/axios'

/**
 * "Pasar lista" de la barra inferior: abre la lista de la clase en curso y,
 * si no hay ninguna iniciada, lleva a Asistencias para iniciar la de hoy.
 */
export default function IrAPasarLista() {
  const [destino, setDestino] = useState(null)

  useEffect(() => {
    let activo = true
    api.get('/clases/docente/panel')
      .then(({ data }) => {
        const sesion = data?.claseActual?.sesion
        if (activo) setDestino(sesion?.activa ? `/docente/pasar-lista/${sesion.id}` : '/asistencias')
      })
      .catch(() => { if (activo) setDestino('/asistencias') })
    return () => { activo = false }
  }, [])

  if (destino) return <Navigate to={destino} replace />
  return <p role="status" className="py-16 text-center text-sm text-muted-foreground">Buscando tu clase…</p>
}
