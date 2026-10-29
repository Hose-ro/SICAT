import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import api from '@/api/axios'
import {
  TIPO_REUNION,
  diaMes,
  fechaReunion,
  horarioReunion,
  hoyClaveLocal,
  lugarReunion,
  separarReuniones,
} from '@/lib/reuniones'

const SIGUIENTES = 3

/** Clases que quedan sin clase por la reunión (se justifican solas al convocar). */
const sinClase = (r) => r.choques?.filter((c) => c.justificacion?.reunionId === r.id && !c.sinClases && !c.listaCapturada) ?? []

/** Panel de Inicio, gemelo de "Clases de hoy": la siguiente reunión destacada y las que vienen después. */
export default function ProximasReuniones({
  reuniones,
  enlaceTodas = '/docente/reuniones',
  enlaceReunion = (reunion) => `/docente/reuniones?reunion=${reunion.id}`,
  tituloVacio = 'No tienes reuniones de academia próximas',
  descripcionVacio = 'Cuando tu jefe de carrera convoque una, aparecerá aquí.',
}) {
  // null mientras carga: así no parpadea el estado vacío.
  const [proximas, setProximas] = useState(null)

  useEffect(() => {
    if (reuniones !== undefined) return
    let vivo = true
    api.get('/reuniones/mias')
      .then(({ data }) => { if (vivo) setProximas(separarReuniones(data).proximas) })
      .catch(() => { if (vivo) setProximas([]) })
    return () => { vivo = false }
  }, [reuniones])

  const lista = reuniones === undefined ? proximas : reuniones === null ? null : separarReuniones(reuniones).proximas
  if (!lista) return null
  const [siguiente, ...despues] = lista

  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Reuniones de academia</h2>
        <Link to={enlaceTodas} className="inline-flex items-center gap-2 text-xs font-medium text-primary-ink">
          Ver todas <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6">
        {siguiente ? (
          <div className="agenda-timeline">
            <div className="agenda-horas"><strong>{siguiente.horaInicio}</strong>{siguiente.horaFin && <span>{siguiente.horaFin}</span>}</div>
            <ReunionDestacada reunion={siguiente} enlace={enlaceReunion(siguiente)} />
          </div>
        ) : (
          <section className="rounded-2xl border border-border bg-card px-5 py-6 text-center">
            <p className="text-sm font-medium text-foreground">{tituloVacio}</p>
            <p className="mt-1 text-sm text-muted-foreground">{descripcionVacio}</p>
          </section>
        )}
      </div>

      {siguiente && despues.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No hay más reuniones programadas.</p>
      )}
      {despues.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {despues.slice(0, SIGUIENTES).map((r) => {
            const { dia, mes } = diaMes(r.fecha)
            return (
              <li key={r.id}>
                <Link to={enlaceReunion(r)} className="flex flex-wrap items-center gap-3 py-3 hover:bg-muted/40">
                  <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{dia} {mes}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{r.titulo}</span>
                    <span className="block truncate text-xs text-muted-foreground">{horarioReunion(r)} · {lugarReunion(r)}</span>
                  </span>
                  {sinClase(r).length > 0 && (
                    <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">{sinClase(r).length === 1 ? '1 clase sin clase' : `${sinClase(r).length} clases sin clase`}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

function ReunionDestacada({ reunion, enlace }) {
  const esHoy = reunion.fecha === hoyClaveLocal()
  const detalle = [lugarReunion(reunion), TIPO_REUNION[reunion.tipo], reunion.carrera?.nombre].filter(Boolean).join(' · ')

  return (
    <section className="agenda-clase rounded-xl bg-muted p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${esHoy ? 'bg-success/22 text-success-foreground' : 'bg-card text-muted-foreground'}`}>
          {esHoy ? 'Hoy' : 'Próxima reunión'}
        </span>
        <span className="text-xs text-muted-foreground">{fechaReunion(reunion.fecha)} · {horarioReunion(reunion)}</span>
      </div>

      <div className="mt-3 flex flex-col items-start gap-5">
        <div className="min-w-0">
          <h3 className="text-xl leading-snug font-semibold tracking-tight text-foreground">{reunion.titulo}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>
          {sinClase(reunion).length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">Sin clase: {sinClase(reunion).map((c) => `${c.materia.nombre}${c.grupo ? ` (${c.grupo.nombre})` : ''}`).join(', ')}</p>
          )}
        </div>
        <Link
          to={enlace}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-strong"
        >
          Ver reunión <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
