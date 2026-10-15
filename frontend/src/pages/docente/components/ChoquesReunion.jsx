import { useId, useState } from 'react'
import { CalendarX2, Check } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/feedback'

const clase = (c) => `${c.materia.nombre}${c.grupo ? ` · ${c.grupo.nombre}` : ''}`

/**
 * Clases del docente que se cruzan con la reunión. Las que justifica quedan
 * como un día sin clases, sólo en ese horario: no cuentan como pendientes y
 * sus alumnos reciben el aviso, igual que con un festivo.
 */
export default function ChoquesReunion({ reunion, onCambio }) {
  const id = useId()
  const choques = reunion.choques ?? []
  const pendientes = choques.filter((c) => !c.justificacion && !c.sinClases && !c.listaCapturada)
  const [seleccion, setSeleccion] = useState(() => pendientes.map((c) => c.horarioId))
  const [motivo, setMotivo] = useState(`Reunión de academia: ${reunion.titulo}`)
  const [guardando, setGuardando] = useState(false)

  if (!choques.length) return null

  const alternar = (horarioId) =>
    setSeleccion((actual) => (actual.includes(horarioId) ? actual.filter((idActual) => idActual !== horarioId) : [...actual, horarioId]))

  const enviar = async (peticion, exito) => {
    setGuardando(true)
    try {
      const { data } = await peticion()
      onCambio(data)
      notify(exito, 'success')
    } catch (error) {
      notify(error.response?.data?.message ?? 'No se pudo guardar la justificación')
    } finally {
      setGuardando(false)
    }
  }

  const justificar = (event) => {
    event.preventDefault()
    const horarioIds = seleccion.filter((h) => pendientes.some((c) => c.horarioId === h))
    if (!horarioIds.length || !motivo.trim()) return
    enviar(
      () => api.post(`/reuniones/${reunion.id}/justificaciones`, { horarioIds, motivo: motivo.trim() }),
      horarioIds.length === 1 ? 'Clase justificada. Tus alumnos ya tienen el aviso.' : 'Clases justificadas. Tus alumnos ya tienen el aviso.',
    )
  }

  const quitar = (c) =>
    enviar(() => api.delete(`/reuniones/${reunion.id}/justificaciones/${c.horarioId}`), `${c.materia.nombre} vuelve a tu día: la clase se imparte normalmente.`)

  return (
    <section aria-labelledby={`${id}-titulo`} className="border-t border-border px-4 py-3">
      <h4 id={`${id}-titulo`} className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
        <CalendarX2 className="size-4 text-warning-foreground" aria-hidden="true" />
        {choques.length === 1 ? 'Se cruza con una de tus clases' : `Se cruza con ${choques.length} de tus clases`}
      </h4>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {choques.map((c) => {
          const seleccionable = pendientes.includes(c)
          const contenido = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-foreground">{clase(c)}</span>
                <span className="block text-xs tabular-nums text-muted-foreground">{c.horaInicio}–{c.horaFin}</span>
                {c.justificacion && <span className="mt-0.5 block text-xs text-muted-foreground">{c.justificacion.motivo}</span>}
              </span>
              {c.justificacion ? (
                <span className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success-foreground"><Check className="size-3" aria-hidden="true" /> Justificada</span>
                  {c.justificacion.reunionId === reunion.id && (
                    <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => quitar(c)} aria-label={`Quitar la justificación de ${clase(c)}`}>Quitar</Button>
                  )}
                </span>
              ) : c.sinClases ? (
                <span className="shrink-0 text-xs text-muted-foreground">Ese día no hay clases</span>
              ) : c.listaCapturada ? (
                <span className="shrink-0 text-xs text-muted-foreground">Ya pasaste lista</span>
              ) : (
                <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">Sin justificar</span>
              )}
            </>
          )
          return (
            <li key={c.horarioId}>
              {seleccionable ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={seleccion.includes(c.horarioId)} onChange={() => alternar(c.horarioId)} disabled={guardando} />
                  {contenido}
                </label>
              ) : (
                <div className="flex min-h-11 items-center gap-3 px-3 py-2">{contenido}</div>
              )}
            </li>
          )
        })}
      </ul>
      {pendientes.length > 0 && reunion.estado !== 'CANCELADA' && (
        <form onSubmit={justificar} className="mt-3 space-y-2">
          <label htmlFor={`${id}-motivo`} className="block text-xs font-medium text-foreground">Por qué no darás la clase</label>
          <textarea
            id={`${id}-motivo`}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            maxLength={500}
            rows={2}
            disabled={guardando}
            className="w-full resize-y rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Cuenta como un día sin clases sólo en ese horario y se avisa a tus alumnos.</p>
            <Button type="submit" size="sm" disabled={guardando || !motivo.trim() || !seleccion.some((h) => pendientes.some((c) => c.horarioId === h))}>
              {guardando ? 'Guardando…' : seleccion.length > 1 ? 'Justificar clases' : 'Justificar clase'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
