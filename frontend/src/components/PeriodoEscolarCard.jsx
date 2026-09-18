import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { usePeriodoStore } from '../store/periodoStore'
import { ETIQUETA_MODALIDAD, esSabado, finMixtoSugerido } from '../lib/periodo'

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

const plural = (n, singular, pluralForm = `${singular}s`) => `${n} ${n === 1 ? singular : pluralForm}`

const fechaCorta = (clave) => aFecha(clave)?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) ?? clave

/** "mixto", "escolarizado" o nada, para intercalar en las frases. */
function nombreCalendario(periodo, conEtiqueta) {
  return conEtiqueta ? ` ${ETIQUETA_MODALIDAD[periodo.modalidad].toLowerCase()}` : ''
}

/**
 * El mixto se cuenta en sábados, no en días: "van 5 de 16" le dice al
 * docente en qué sesión va; "quedan 86 días" no.
 */
function notaCorta(periodo) {
  const restantes = diasHasta(periodo.fechaFin)
  const faltaIniciar = diasHasta(periodo.fechaInicio)
  if (!periodo.configurado) return 'Fechas estimadas: captúralas en Horario'
  if (faltaIniciar > 0) return `comienza en ${plural(faltaIniciar, 'día')}`
  const sabados = periodo.sabados
  if (sabados) {
    return sabados.transcurridos < sabados.conClase
      ? `van ${sabados.transcurridos} de ${sabados.conClase} sábados`
      : `terminaron los ${sabados.conClase} sábados`
  }
  if (restantes >= 0) return `quedan ${plural(restantes, 'día')}`
  return `terminó hace ${plural(Math.abs(restantes), 'día')}`
}

function notaLarga(periodo) {
  const restantes = diasHasta(periodo.fechaFin)
  const faltaIniciar = diasHasta(periodo.fechaInicio)
  if (!periodo.configurado) {
    return 'Fechas estimadas por calendario: captúralas para acotar las asistencias atrasadas.'
  }
  const sabados = periodo.sabados
  if (faltaIniciar > 0) {
    return sabados
      ? `Empieza el ${fechaCorta(periodo.fechaInicio)}: ${sabados.conClase} sábados de clase.`
      : `El periodo comienza en ${plural(faltaIniciar, 'día')}.`
  }
  if (sabados) {
    const faltan = sabados.conClase - sabados.transcurridos
    return faltan > 0
      ? `Van ${sabados.transcurridos} de ${sabados.conClase} sábados de clase; ${faltan === 1 ? 'queda 1' : `quedan ${faltan}`}.`
      : `Terminó: ${sabados.conClase} sábados de clase.`
  }
  if (restantes >= 0) return `Quedan ${plural(restantes, 'día')} para terminar el periodo.`
  return `El periodo terminó hace ${plural(Math.abs(restantes), 'día')}.`
}

/** Los festivos en sábado dejan el semestre corto: se avisa y se propone el nuevo fin. */
function avisoSabados(periodo) {
  const sabados = periodo.sabados
  if (!sabados || sabados.conClase >= sabados.requeridos) return null
  const lista = sabados.sinClases.map((item) => fechaCorta(item.fecha)).join(', ')
  return `Con ${plural(sabados.sinClases.length, 'sábado')} sin clases (${lista}) sólo hay ${sabados.conClase} de ${sabados.requeridos} sábados de clase; extiende el fin al ${formatearFechaLarga(sabados.finSugerido)}.`
}

/**
 * Periodo escolar en curso. Los grupos mixtos llevan su propio calendario,
 * así que se muestra un bloque por cada modalidad que le toque al usuario:
 * al admin ambas, al docente las de sus grupos. En modo `editable` se
 * capturan las fechas reales; en el resto de la app se muestra sólo como
 * referencia.
 */
export default function PeriodoEscolarCard({ editable = false, compacto = false }) {
  const { periodos, cargarPeriodos, guardarPeriodo } = usePeriodoStore()
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ fechaInicio: '', fechaFin: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    cargarPeriodos().catch(() => {})
  }, [cargarPeriodos])

  if (!periodos) return null

  const calendarios = [periodos.escolarizado, periodos.mixto].filter((p) => p.aplica)
  // Con un solo calendario escolarizado no hace falta nombrarlo: es "el" periodo.
  const conEtiqueta = calendarios.length > 1 || calendarios[0]?.modalidad === 'MIXTO'

  const empezarEdicion = (periodo) => {
    setEditando(periodo.modalidad)
    setForm({ fechaInicio: periodo.fechaInicio, fechaFin: periodo.fechaFin })
    setError('')
    setMensaje('')
  }

  // En el mixto el fin se propone solo: el sábado 16 contando el de inicio.
  const cambiarInicio = (fechaInicio) => {
    setForm((previo) => ({
      fechaInicio,
      fechaFin: editando === 'MIXTO' ? finMixtoSugerido(fechaInicio) : previo.fechaFin,
    }))
  }
  const inicioNoEsSabado = editando === 'MIXTO' && form.fechaInicio && !esSabado(form.fechaInicio)

  const guardar = async (event) => {
    event.preventDefault()
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      await guardarPeriodo({ modalidad: editando, ...form })
      setMensaje(`Fechas del periodo${nombreCalendario({ modalidad: editando }, conEtiqueta)} actualizadas.`)
      setEditando(null)
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron guardar las fechas del periodo.')
    } finally {
      setGuardando(false)
    }
  }

  // En modo referencia basta una línea por calendario: las fechas y cuánto falta.
  if (compacto) {
    return (
      <div className="space-y-1">
        {calendarios.map((periodo) => (
          <p key={periodo.modalidad} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4 shrink-0 text-primary-ink" />
            <span className="text-foreground">
              Semestre{nombreCalendario(periodo, conEtiqueta)} del {formatearRango(periodo.fechaInicio, periodo.fechaFin)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{notaCorta(periodo)}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink">
          <CalendarRange className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Periodo escolar</h2>
          {conEtiqueta && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Los grupos mixtos (sábados) tienen su propio calendario de inicio y fin de semestre.
            </p>
          )}
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${calendarios.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {calendarios.map((periodo) => {
          const enEdicion = editando === periodo.modalidad
          return (
            <article
              key={periodo.modalidad}
              aria-label={`Periodo ${ETIQUETA_MODALIDAD[periodo.modalidad].toLowerCase()}`}
              className={conEtiqueta ? 'rounded-xl border border-border bg-background p-4' : ''}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {conEtiqueta && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-ink">
                      {ETIQUETA_MODALIDAD[periodo.modalidad]}
                      <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">
                        · {periodo.modalidad === 'MIXTO' ? 'sábados' : 'lunes a viernes'}
                      </span>
                    </p>
                  )}
                  <p className={`text-sm ${conEtiqueta ? 'mt-1 text-foreground' : 'text-muted-foreground'}`}>
                    Del {formatearFechaLarga(periodo.fechaInicio)} al{' '}
                    {formatearFechaLarga(periodo.fechaFin)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{notaLarga(periodo)}</p>
                  {avisoSabados(periodo) && (
                    <p role="note" className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                      {avisoSabados(periodo)}
                    </p>
                  )}
                </div>

                {editable && !enEdicion && (
                  <Button variant="outline"
                    type="button"
                    onClick={() => empezarEdicion(periodo)}
                    disabled={editando !== null}
                    className="border px-3 py-2 text-sm font-medium"
                  >
                    {periodo.configurado ? 'Editar fechas' : 'Establecer fechas'}
                  </Button>
                )}
              </div>

              {editable && enEdicion && (
                <form onSubmit={guardar} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="min-w-0">
                      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Inicio del semestre{nombreCalendario(periodo, conEtiqueta)}
                      </span>
                      <input
                        type="date"
                        required
                        value={form.fechaInicio}
                        onChange={(e) => cambiarInicio(e.target.value)}
                        aria-invalid={inicioNoEsSabado || undefined}
                        className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 aria-[invalid]:border-destructive"
                      />
                      {inicioNoEsSabado && (
                        <span className="mt-1 block text-xs text-destructive-foreground">El semestre mixto inicia en sábado.</span>
                      )}
                    </label>
                    <label className="min-w-0">
                      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Fin del semestre{nombreCalendario(periodo, conEtiqueta)}
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
                    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
                      {error}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {periodo.modalidad === 'MIXTO' && 'El semestre mixto son 16 sábados: el fin se propone al sábado 16 y puedes moverlo si hay reposiciones. '}
                    Las asistencias atrasadas de los grupos{' '}
                    {periodo.modalidad === 'MIXTO' ? 'mixtos' : 'escolarizados'} sólo se podrán capturar dentro de estas fechas.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="default"
                      type="submit"
                      disabled={guardando}
                      className="px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {guardando ? 'Guardando...' : 'Guardar fechas'}
                    </Button>
                    <Button variant="outline"
                      type="button"
                      onClick={() => {
                        setEditando(null)
                        setError('')
                      }}
                      disabled={guardando}
                      className="border px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </article>
          )
        })}
      </div>

      {mensaje && !editando && (
        <p role="status" className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {mensaje}
        </p>
      )}
    </section>
  )
}
