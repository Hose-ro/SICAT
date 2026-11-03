import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import { linkClass } from './ui'

/**
 * Alumnos que coinciden con la búsqueda. El expediente se abre en su grupo
 * base, que es donde vive con todas sus inscripciones del periodo.
 */
export default function ResultadosAlumnos({ j, resumen, busqueda, hayGrupos }) {
  if (!busqueda.activa) return null
  const activos = new Map(resumen.grupos.map((g) => [g.id, g]))
  return (
    <div aria-live="polite">
      {busqueda.buscando ? (
        <p className="mt-3 flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Buscando alumnos…</p>
      ) : busqueda.error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-warning-foreground">{busqueda.error}.</p>
      ) : !busqueda.items.length ? (
        !hayGrupos && <p className="mt-3 text-[0.8125rem] text-muted-foreground">Ningún alumno ni grupo coincide con «{busqueda.texto}».</p>
      ) : (
        <ul className="consulta-resultados" aria-label="Alumnos encontrados">
          {busqueda.items.map((a) => {
            const grupo = a.grupo ? activos.get(a.grupo.id) : null
            return (
              <li key={a.id} className="consulta-alumno">
                {a.sexo && <SexoBadge sexo={a.sexo} />}
                <span className="font-medium text-foreground">{a.nombre}</span>
                <span className="consulta-tenue tabular-nums">{a.numeroControl ?? 'Sin número de control'}</span>
                <span className="ml-auto">
                  {grupo ? (
                    <Link className={cn(linkClass, 'text-xs')} to={j.toDesde(`/jefe-carrera/grupos/${grupo.id}`, { tab: 'alumnos', alumno: a.id })}>Expediente · grupo {grupo.nombre}</Link>
                  ) : (
                    <span className="consulta-tenue">{a.grupo ? `Grupo base ${a.grupo.nombre}, sin actividad en el periodo` : 'Sin grupo base asignado'}</span>
                  )}
                </span>
              </li>
            )
          })}
          {busqueda.items.length === 30 && <li className="consulta-alumno consulta-tenue">Se muestran los primeros 30; escribe más para acotar.</li>}
        </ul>
      )}
    </div>
  )
}
