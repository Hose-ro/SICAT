import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import api from '@/api/axios'
import { diaMes, horarioReunion, lugarReunion, separarReuniones } from '@/lib/reuniones'

const VISIBLES = 3

/** Tarjeta de Inicio: las siguientes reuniones de academia. Sin reuniones no ocupa lugar. */
export default function ProximasReuniones() {
  const [proximas, setProximas] = useState([])

  useEffect(() => {
    let vivo = true
    api.get('/reuniones/mias')
      .then(({ data }) => { if (vivo) setProximas(separarReuniones(data).proximas) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  if (!proximas.length) return null
  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Reuniones de academia</h2>
        <Link to="/docente/reuniones" className="text-xs font-medium text-primary-ink underline-offset-4 hover:underline">Ver todas</Link>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {proximas.slice(0, VISIBLES).map((r) => {
          const { dia, mes } = diaMes(r.fecha)
          return (
            <li key={r.id}>
              <Link to={`/docente/reuniones?reunion=${r.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted/50">
                <span aria-hidden="true" className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-muted py-1 leading-none">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{dia}</span>
                  <span className="mt-0.5 text-[0.625rem] uppercase text-muted-foreground">{mes}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{r.titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{horarioReunion(r)} · {lugarReunion(r)}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
