import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { modalidadTexto, plural } from '../supervision/formato'
import { SeccionTitulo, linkClass } from '../supervision/ui'
import { comparativoGrupos, textoMotivosGrupo } from './riesgo'
import './graficas.css'

/**
 * Proporción de alumnos en riesgo por grupo. La barra se divide en quienes ya
 * reprueban alguna unidad (rojo) y el resto en riesgo (ámbar). Los motivos se
 * dan como cifras aparte: un alumno puede tener varios y apilarlos inflaría
 * la barra.
 */
export default function ComparativoRiesgo({ j, grupos }) {
  const todos = comparativoGrupos(grupos)
  if (!todos?.length) return null
  // Solo los grupos con riesgo llevan barra; los demás se nombran en una línea.
  const filas = todos.filter((g) => g.alumnosRiesgo > 0)
  const sanos = todos.filter((g) => !g.alumnosRiesgo)
  const conRiesgo = filas.length

  return (
    <section className="viz mt-8" aria-labelledby="comparativo-riesgo">
      <SeccionTitulo
        id="comparativo-riesgo"
        titulo="Riesgo por grupo"
        descripcion={conRiesgo
          ? 'Porcentaje de alumnos con señales de riesgo en alguna materia del grupo. Abre un grupo para ver quién y en qué materia.'
          : 'Ningún grupo tiene alumnos con señales de riesgo en este periodo.'}
      />
      {conRiesgo > 0 && <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="viz-muestra viz-riesgo--reprobado" aria-hidden="true" />Reprobando alguna unidad</span>
        <span className="inline-flex items-center gap-1.5"><span className="viz-muestra viz-riesgo--alerta" aria-hidden="true" />En riesgo</span>
      </div>}
      {conRiesgo > 0 && <ul className="divide-y divide-border border-y border-border">
        {filas.map((g) => {
          const motivos = textoMotivosGrupo(g.motivos)
          const destino = g.periodoDisponible === false ? null : j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta, tab: 'riesgo' })
          const etiqueta = `${g.nombre}: ${g.porcentaje} % en riesgo, ${plural(g.alumnosRiesgo, 'alumno', 'alumnos')} de ${g.alumnosEvaluados}${g.motivos.reprobando ? `, ${g.motivos.reprobando} reprobando` : ''}.`
          return (
            <li key={g.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.25rem] items-center gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)_3.5rem]">
              <span className="min-w-0">
                {destino
                  ? <Link to={destino} aria-label={`${etiqueta} Ver mapa de riesgo.`} className={cn(linkClass, 'inline-flex min-h-11 items-center text-sm font-medium text-foreground sm:min-h-0')}>{g.nombre}</Link>
                  : <span className="text-sm font-medium text-foreground"><span aria-hidden="true">{g.nombre}</span><span className="sr-only">{etiqueta}</span></span>}
                <span className="block truncate text-xs text-muted-foreground">{modalidadTexto(g.modalidad)}</span>
              </span>
              {/* Un solo momento al abrir: cada barra se revela de izquierda a derecha. */}
              <span className="viz-revelar relative h-2.5 overflow-hidden rounded-full bg-[var(--viz-grid)]" aria-hidden="true">
                <span className="viz-barra absolute inset-0 bg-[var(--viz-riesgo-alerta)]" style={{ transform: `scaleX(${g.porcentaje / 100})` }} />
                <span className="viz-barra absolute inset-0 bg-[var(--viz-riesgo-reprobado)]" style={{ transform: `scaleX(${g.reprobando / 100})` }} />
              </span>
              <span className={cn('text-right text-sm tabular-nums', g.porcentaje ? 'font-semibold text-foreground' : 'text-muted-foreground')} aria-hidden="true">{g.porcentaje} %</span>
              <span className="col-start-2 col-end-4 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{g.alumnosRiesgo} de {g.alumnosEvaluados}. {motivos}</span>
            </li>
          )
        })}
      </ul>}
      {sanos.length > 0 && conRiesgo > 0 && (
        <p className="mt-2.5 text-[0.8125rem] text-muted-foreground">
          Sin alumnos en riesgo: {sanos.map((g, i) => (
            <span key={g.id}>{i > 0 && ', '}{g.periodoDisponible === false ? g.nombre : <Link className={linkClass} to={j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta, tab: 'riesgo' })} aria-label={`${g.nombre}, sin alumnos en riesgo`}>{g.nombre}</Link>}</span>
          ))}.
        </p>
      )}
      {conRiesgo > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Un alumno puede tener varios motivos; por eso las cifras por motivo no suman el total.</p>}
    </section>
  )
}
