import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoaderCircle, Search } from 'lucide-react'
import api from '@/api/axios'
import { cn } from '@/lib/utils'
import { mensajeError } from './useJefatura'
import { linkClass } from './ui'

/**
 * Búsqueda de alumnos de la carrera por nombre o número de control (el mismo
 * endpoint autorizado que usa la incorporación). El expediente se abre en su
 * grupo base, que es donde vive con todas sus inscripciones del periodo.
 */
export default function BuscarAlumno({ j, resumen }) {
  const ids = useId()
  const [params, setParams] = useSearchParams()
  const q = params.get('alumno') ?? ''
  const [estado, setEstado] = useState({ q: '', items: [], error: '' })
  const texto = q.trim()

  useEffect(() => {
    if (texto.length < 2) return undefined
    let vivo = true
    const timer = setTimeout(() => {
      api.get('/jefe-carrera/alumnos/buscar', { params: { carreraId: j.carreraId, periodo: j.periodo, q: texto } })
        .then(({ data }) => { if (vivo) setEstado({ q: texto, items: Array.isArray(data) ? data : [], error: '' }) })
        .catch((e) => { if (vivo) setEstado({ q: texto, items: [], error: mensajeError(e, 'No se pudo buscar') }) })
    }, 250)
    return () => { vivo = false; clearTimeout(timer) }
  }, [texto, j.carreraId, j.periodo])

  const cambiar = (valor) => {
    const next = new URLSearchParams(params)
    if (valor) next.set('alumno', valor); else next.delete('alumno')
    setParams(next, { replace: true })
  }
  const activos = new Map(resumen.grupos.map((g) => [g.id, g]))
  const buscando = texto.length >= 2 && estado.q !== texto

  return (
    <section aria-labelledby={`${ids}-titulo`} className="mt-6">
      <h2 id={`${ids}-titulo`} className="text-sm font-semibold text-foreground">Buscar un alumno</h2>
      <label className="relative mt-2 block max-w-md">
        <span className="sr-only">Nombre o número de control del alumno</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search" value={q} onChange={(e) => cambiar(e.target.value)} placeholder="Nombre o número de control"
          aria-describedby={`${ids}-ayuda`}
          className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      </label>
      <p id={`${ids}-ayuda`} className="mt-1.5 text-xs text-muted-foreground">Alumnos registrados en la carrera. Quien cursa aquí desde otra carrera se consulta en el grupo o la materia donde está inscrito.</p>

      {texto.length >= 2 && (
        <div aria-live="polite" className="mt-3">
          {buscando ? (
            <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Buscando…</p>
          ) : estado.error ? (
            <p role="alert" className="text-[0.8125rem] text-warning-foreground">{estado.error}. La consulta por grupo sigue disponible abajo.</p>
          ) : !estado.items.length ? (
            <p className="text-[0.8125rem] text-muted-foreground">Ningún alumno de la carrera coincide con «{texto}».</p>
          ) : (
            <ul className="max-w-2xl divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card text-[0.8125rem]">
              {estado.items.map((a) => {
                const grupo = a.grupo ? activos.get(a.grupo.id) : null
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{a.nombre}</span>
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">{a.numeroControl ?? 'Sin número de control'}</span>
                    </span>
                    {grupo ? (
                      <Link className={cn(linkClass, 'text-xs')} to={j.toDesde(`/jefe-carrera/grupos/${grupo.id}`, { tab: 'alumnos', alumno: a.id })}>Expediente · grupo {grupo.nombre}</Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{a.grupo ? `Grupo base ${a.grupo.nombre}, sin actividad en el periodo` : 'Sin grupo base asignado'}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {estado.items.length === 30 && !buscando && <p className="mt-1.5 text-xs text-muted-foreground">Se muestran los primeros 30; escribe más para acotar.</p>}
        </div>
      )}
    </section>
  )
}
