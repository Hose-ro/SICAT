import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { usePeriodoStore } from '../store/periodoStore'

function aFecha(clave) {
  const [year, month, day] = (clave || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatearFechaLarga(clave) {
  const fecha = aFecha(clave)
  if (!fecha) return clave || '—'
  return fecha.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "31 de agosto al 18 de diciembre de 2026": el año sólo se dice una vez. */
function formatearRango(inicio, fin) {
  const a = aFecha(inicio)
  const b = aFecha(fin)
  if (!a || !b) return `${inicio} al ${fin}`
  const corto = { day: 'numeric', month: 'long' }
  const desde = a.toLocaleDateString('es-MX',
    a.getFullYear() === b.getFullYear() ? corto : { ...corto, year: 'numeric' })
  return `${desde} al ${b.toLocaleDateString('es-MX', { ...corto, year: 'numeric' })}`
}

/** Días entre hoy y una clave `YYYY-MM-DD`, en positivo si aún no llega. */
function diasHasta(clave) {
  const [year, month, day] = (clave || '').split('-').map(Number)
  if (!year) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(year, month - 1, day) - hoy) / 86400000)
}

/**
 * Periodo escolar en curso. En modo `editable` el docente captura las fechas
 * reales; en el resto de la app se muestra sólo como referencia.
 */
export default function PeriodoEscolarCard({ editable = false, compacto = false }) {
  const { periodo, cargarPeriodo, guardarPeriodo } = usePeriodoStore()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ fechaInicio: '', fechaFin: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    cargarPeriodo().catch(() => {})
  }, [cargarPeriodo])

  useEffect(() => {
    if (periodo) setForm({ fechaInicio: periodo.fechaInicio, fechaFin: periodo.fechaFin })
  }, [periodo])

  if (!periodo) return null

  const restantes = diasHasta(periodo.fechaFin)
  const faltaIniciar = diasHasta(periodo.fechaInicio)

  const guardar = async (event) => {
    event.preventDefault()
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      await guardarPeriodo(form)
      setEditando(false)
      setMensaje('Fechas del periodo actualizadas.')
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron guardar las fechas del periodo.')
    } finally {
      setGuardando(false)
    }
  }

  const nota = !periodo.configurado
    ? 'Fechas estimadas: captúralas en Horario'
    : faltaIniciar > 0
      ? `comienza en ${faltaIniciar} día${faltaIniciar === 1 ? '' : 's'}`
      : restantes >= 0
        ? `quedan ${restantes} día${restantes === 1 ? '' : 's'}`
        : `terminó hace ${Math.abs(restantes)} día${Math.abs(restantes) === 1 ? '' : 's'}`

  // En modo referencia basta una línea: las fechas y cuánto falta.
  if (compacto) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-foreground">
          Semestre del {formatearRango(periodo.fechaInicio, periodo.fechaFin)}
        </span>
        <span aria-hidden="true">·</span>
        <span>{nota}</span>
      </p>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Periodo escolar
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Del {formatearFechaLarga(periodo.fechaInicio)} al{' '}
              {formatearFechaLarga(periodo.fechaFin)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {!periodo.configurado
                ? 'Fechas estimadas por calendario: captúralas para acotar las asistencias atrasadas.'
                : `${nota.charAt(0).toUpperCase()}${nota.slice(1)} de clases.`}
            </p>
          </div>
        </div>

        {editable && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/50"
          >
            {periodo.configurado ? 'Editar fechas' : 'Establecer fechas'}
          </button>
        )}
      </div>

      {mensaje && !editando && (
        <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {mensaje}
        </p>
      )}

      {editable && editando && (
        <form onSubmit={guardar} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Inicio del semestre
              </span>
              <input
                type="date"
                required
                value={form.fechaInicio}
                onChange={(e) => setForm((p) => ({ ...p, fechaInicio: e.target.value }))}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Fin del semestre
              </span>
              <input
                type="date"
                required
                value={form.fechaFin}
                onChange={(e) => setForm((p) => ({ ...p, fechaFin: e.target.value }))}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Las asistencias atrasadas sólo se podrán capturar dentro de estas fechas.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? 'Guardando...' : 'Guardar fechas'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false)
                setError('')
                setForm({ fechaInicio: periodo.fechaInicio, fechaFin: periodo.fechaFin })
              }}
              disabled={guardando}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
