import { useId, useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { confirmAction, notify } from '@/lib/feedback'
import { hoyClaveLocal } from '@/lib/reuniones'

const clase = (c) => `${c.materia.nombre}${c.grupo ? ` · ${c.grupo.nombre}` : ''}`

/**
 * Clases del docente que se cruzan con la reunión. Al convocarlo quedan sin
 * clase solas (un día sin clases sólo en ese horario: no se pasa lista ni
 * cuentan para la calificación). Aquí decide si sus alumnos ven el aviso, si
 * de todos modos dará la clase, o vuelve a dejarla sin clase.
 */
export default function ChoquesReunion({ reunion, onCambio }) {
  const id = useId()
  const choques = reunion.choques ?? []
  const [guardando, setGuardando] = useState(null)
  // El interruptor cambia al instante; si el guardado falla, vuelve a su valor.
  const [optimista, setOptimista] = useState({})

  if (!choques.length) return null
  const editable = reunion.estado !== 'CANCELADA' && reunion.fecha >= hoyClaveLocal()
  const sinClase = choques.filter((c) => c.justificacion && !c.sinClases)

  const enviar = async (horarioId, peticion, exito) => {
    setGuardando(horarioId)
    try {
      const { data } = await peticion()
      onCambio(data)
      notify(exito, 'success')
    } catch (error) {
      notify(error.response?.data?.message ?? 'No se pudo guardar el cambio')
    } finally {
      setGuardando(null)
    }
  }

  const avisar = async (c, avisarAlumnos) => {
    setOptimista((o) => ({ ...o, [c.horarioId]: avisarAlumnos }))
    await enviar(
      c.horarioId,
      () => api.patch(`/reuniones/${reunion.id}/justificaciones/${c.horarioId}`, { avisarAlumnos }),
      avisarAlumnos ? `Tus alumnos de ${clase(c)} ya tienen el aviso.` : `Se retiró el aviso a tus alumnos de ${clase(c)}.`,
    )
    setOptimista((o) => {
      const resto = { ...o }
      delete resto[c.horarioId]
      return resto
    })
  }
  const darClase = async (c) => {
    const ok = await confirmAction({
      title: `¿Darás ${c.materia.nombre}?`,
      description: c.justificacion.avisarAlumnos
        ? 'La clase vuelve a tu día y se avisa a tus alumnos que sí hay clase.'
        : 'La clase vuelve a tu día y tendrás que pasar lista.',
      confirmLabel: 'Sí daré la clase',
    })
    if (!ok) return
    enviar(c.horarioId, () => api.delete(`/reuniones/${reunion.id}/justificaciones/${c.horarioId}`), `${c.materia.nombre} vuelve a tu día: la clase se imparte normalmente.`)
  }
  const dejarSinClase = (c) => enviar(
    c.horarioId,
    () => api.post(`/reuniones/${reunion.id}/justificaciones`, { horarioIds: [c.horarioId], motivo: `Reunión de academia: ${reunion.titulo}`.slice(0, 500) }),
    `${c.materia.nombre} queda sin clase por la reunión.`,
  )

  return (
    <section aria-labelledby={`${id}-titulo`} className="border-t border-border px-4 py-3">
      <h4 id={`${id}-titulo`} className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
        <CalendarX2 className="size-4 text-warning-foreground" aria-hidden="true" />
        {sinClase.length
          ? sinClase.length === 1 ? 'Una de tus clases queda sin clase por la reunión' : `${sinClase.length} de tus clases quedan sin clase por la reunión`
          : choques.length === 1 ? 'Se cruza con una de tus clases' : `Se cruza con ${choques.length} de tus clases`}
      </h4>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {choques.map((c) => {
          const propia = c.justificacion?.reunionId === reunion.id
          const ocupado = guardando === c.horarioId
          return (
            <li key={c.horarioId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-foreground">{clase(c)}</span>
                <span className="block text-xs tabular-nums text-muted-foreground">{c.horaInicio}–{c.horaFin}</span>
              </span>
              {c.sinClases ? (
                <span className="shrink-0 text-xs text-muted-foreground">Ese día no hay clases</span>
              ) : c.listaCapturada ? (
                <span className="shrink-0 text-xs text-muted-foreground">Ya pasaste lista</span>
              ) : c.justificacion ? (
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{propia ? 'Sin clase por la reunión' : 'Sin clase por otra reunión'}</span>
                  {propia && editable && (
                    <>
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-foreground">
                        <input type="checkbox" className="size-4 accent-primary" checked={optimista[c.horarioId] ?? c.justificacion.avisarAlumnos} disabled={ocupado} onChange={(e) => avisar(c, e.target.checked)} />
                        Avisar a mis alumnos
                      </label>
                      <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => darClase(c)} aria-label={`Sí daré ${clase(c)}`}>Sí daré la clase</Button>
                    </>
                  )}
                </span>
              ) : (
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs text-muted-foreground">Se imparte normalmente</span>
                  {editable && <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => dejarSinClase(c)}>Dejar sin clase</Button>}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {sinClase.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No hace falta pasar lista y no cuenta para la calificación. Si das la clase de todos modos, puedes pasar lista después desde Asistencias y entonces sí cuenta.
        </p>
      )}
    </section>
  )
}
