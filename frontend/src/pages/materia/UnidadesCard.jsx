import { useEffect, useState } from 'react'
import api from '../../api/axios'

const ESTADO_UNIDAD = {
  PENDIENTE: 'bg-slate-100 text-slate-700',
  ACTIVA: 'bg-emerald-100 text-emerald-700',
  FINALIZADA: 'bg-blue-100 text-blue-700',
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
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Unidades</h3>
        {puedeEditar && (
          <div className="flex items-center gap-2">
            <label htmlFor="materia-unidades" className="text-xs font-medium text-gray-500">
              Total
            </label>
            <input
              id="materia-unidades"
              type="number"
              min={1}
              max={12}
              value={valor}
              onChange={(event) => setValor(event.target.value)}
              className="w-20 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => guardar(false)}
              disabled={guardando || sinCambios}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {puedeEditar && (
        <p className="mt-2 text-xs text-gray-500">
          Las unidades son de la materia: el cambio lo ven todos los grupos que la llevan.
        </p>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}

      {confirmacion && (
        <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">{confirmacion.message}</p>
          <p className="text-xs text-amber-700">Esta acción no se puede deshacer.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => guardar(true)}
              disabled={guardando}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {guardando ? 'Borrando...' : 'Borrar y reducir'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmacion(null)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {unidades.map((unidad) => (
          <div key={unidad.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-800">{unidad.orden}. {unidad.nombre}</p>
                <p className="mt-1 text-xs text-gray-500">
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
          <p className="text-sm text-gray-400">No hay unidades registradas.</p>
        )}
      </div>
    </article>
  )
}
