import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import api from '../../api/axios'

const ESTADO_UNIDAD = {
  PENDIENTE: "bg-muted text-foreground",
  ACTIVA: "bg-success/10 text-success-foreground",
  FINALIZADA: "bg-accent text-primary-ink",
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}

/**
 * El número de unidades lo define el admin o el docente que imparte la materia.
 * Reducirlo borra lo registrado en las unidades sobrantes, así que el servidor
 * pide confirmación y aquí se muestra exactamente qué se perdería.
 */
export default function UnidadesCard({ materia, puedeEditar, onActualizado }) {
  const unidades = materia.unidades ?? []
  const [valor, setValor] = useState(String(unidades.length || materia.numUnidades || 3))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)

  useEffect(() => {
    setValor(String(unidades.length || materia.numUnidades || 3))
    setConfirmacion(null)
    setError('')
  }, [materia.id, unidades.length, materia.numUnidades])

  const guardar = async (forzar = false) => {
    const numUnidades = Number(valor)
    if (!Number.isInteger(numUnidades) || numUnidades < 1 || numUnidades > 12) {
      setError('Indica un número de unidades entre 1 y 12')
      return
    }

    setGuardando(true)
    setError('')
    try {
      await api.patch(`/materias/${materia.id}/unidades`, { numUnidades, forzar })
      setConfirmacion(null)
      await onActualizado?.()
    } catch (err) {
      const data = err?.response?.data
      if (data?.requiereConfirmacion) {
        setConfirmacion(data)
      } else {
        setError(mensajeError(err, 'No se pudieron actualizar las unidades'))
      }
    } finally {
      setGuardando(false)
    }
  }

  const sinCambios = Number(valor) === unidades.length

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Unidades</h2>
        {puedeEditar && (
          <div className="flex items-center gap-2">
            <label htmlFor="materia-unidades" className="text-xs font-medium text-muted-foreground">
              Total
            </label>
            <input
              id="materia-unidades"
              type="number"
              min={1}
              max={12}
              value={valor}
              onChange={(event) => setValor(event.target.value)}
              className="w-20 rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button variant="default"
              type="button"
              onClick={() => guardar(false)}
              disabled={guardando || sinCambios}
              className="px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {puedeEditar && (
        <p className="mt-2 text-xs text-muted-foreground">
          Las unidades son de la materia: el cambio lo ven todos los grupos que la llevan.
        </p>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-destructive-foreground">{error}</p>}

      {confirmacion && (
        <div className="mt-3 space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm text-warning-foreground">{confirmacion.message}</p>
          <p className="text-xs text-warning-foreground">Esta acción no se puede deshacer.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive"
              type="button"
              onClick={() => guardar(true)}
              disabled={guardando}
              className="px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              {guardando ? 'Borrando...' : 'Borrar y reducir'}
            </Button>
            <Button variant="outline"
              type="button"
              onClick={() => setConfirmacion(null)}
              className="border px-3 py-2 text-xs font-medium"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {unidades.map((unidad) => (
          <div key={unidad.id} className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{unidad.orden}. {unidad.nombre}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(unidad.fechaInicio) ? `Inicio: ${formatDate(unidad.fechaInicio)}` : 'Sin inicio'} · {formatDate(unidad.fechaFin) ? `Fin: ${formatDate(unidad.fechaFin)}` : 'Sin cierre'}
                </p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_UNIDAD[unidad.status] || ESTADO_UNIDAD.PENDIENTE}`}>
                {unidad.status}
              </span>
            </div>
          </div>
        ))}
        {unidades.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay unidades registradas.</p>
        )}
      </div>
    </article>
  )
}
