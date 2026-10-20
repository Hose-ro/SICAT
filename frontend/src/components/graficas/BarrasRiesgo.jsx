import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { textoMotivosGrupo } from './riesgo'
import './graficas.css'

const enlace = 'underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40'

/** Nombre de la fila: enlace, botón o texto, con la descripción completa para lectores de pantalla. */
function Nombre({ fila, etiqueta, className }) {
  if (fila.to) return <Link to={fila.to} aria-label={etiqueta} className={cn(enlace, className)}>{fila.nombre}</Link>
  if (fila.onClick) return <button type="button" onClick={fila.onClick} aria-label={etiqueta} className={cn(enlace, 'text-left', className)}>{fila.nombre}</button>
  return <span className={className}><span aria-hidden="true">{fila.nombre}</span><span className="sr-only">{etiqueta}</span></span>
}

/**
 * Proporción de alumnos en riesgo por fila (grupos en la jefatura, clases
 * para el docente). La barra se divide en quienes ya reprueban alguna unidad
 * (rojo) y el resto en riesgo (ámbar); los motivos van como cifras aparte
 * porque un alumno puede tener varios y apilarlos inflaría la barra. Las
 * filas sin riesgo se nombran en una sola línea.
 *
 * filas: [{ id, nombre, detalle, alumnosRiesgo, evaluados, reprobando (n), motivos, to | onClick }]
 */
export default function BarrasRiesgo({ filas, accion = 'Ver detalle', sinRiesgoTexto = 'Sin alumnos en riesgo' }) {
  const porcentaje = (n, total) => (total ? Math.round((n / total) * 100) : 0)
  const conRiesgo = filas
    .filter((f) => f.alumnosRiesgo > 0)
    .map((f) => ({ ...f, porcentaje: porcentaje(f.alumnosRiesgo, f.evaluados), pctReprobando: porcentaje(f.reprobando, f.evaluados) }))
    .sort((a, b) => b.porcentaje - a.porcentaje || a.nombre.localeCompare(b.nombre, 'es'))
  const sanos = filas.filter((f) => !f.alumnosRiesgo)
  if (!conRiesgo.length) return null

  return (
    <div className="viz">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="viz-muestra viz-riesgo--reprobado" aria-hidden="true" />Reprobando alguna unidad</span>
        <span className="inline-flex items-center gap-1.5"><span className="viz-muestra viz-riesgo--alerta" aria-hidden="true" />En riesgo</span>
      </div>
      <ul className="divide-y divide-border border-y border-border">
        {conRiesgo.map((f) => {
          const etiqueta = `${f.nombre}${f.detalle ? `, ${f.detalle}` : ''}: ${f.porcentaje} % en riesgo, ${f.alumnosRiesgo} de ${f.evaluados} alumnos${f.reprobando ? `, ${f.reprobando} reprobando` : ''}. ${accion}.`
          return (
            <li key={f.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.25rem] items-center gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_3.5rem]">
              <span className="min-w-0">
                <Nombre fila={f} etiqueta={etiqueta} className="inline-flex min-h-11 items-center text-sm font-medium text-foreground sm:min-h-0" />
                {f.detalle && <span className="block truncate text-xs text-muted-foreground">{f.detalle}</span>}
              </span>
              {/* Un solo momento al abrir: cada barra se revela de izquierda a derecha. */}
              <span className="viz-revelar relative h-2.5 overflow-hidden rounded-full bg-[var(--viz-grid)]" aria-hidden="true">
                <span className="viz-barra absolute inset-0 bg-[var(--viz-riesgo-alerta)]" style={{ transform: `scaleX(${f.porcentaje / 100})` }} />
                <span className="viz-barra absolute inset-0 bg-[var(--viz-riesgo-reprobado)]" style={{ transform: `scaleX(${f.pctReprobando / 100})` }} />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-foreground" aria-hidden="true">{f.porcentaje} %</span>
              <span className="col-start-2 col-end-4 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{f.alumnosRiesgo} de {f.evaluados}. {textoMotivosGrupo(f.motivos)}</span>
            </li>
          )
        })}
      </ul>
      {sanos.length > 0 && (
        <p className="mt-2.5 text-[0.8125rem] text-muted-foreground">
          {sinRiesgoTexto}: {sanos.map((f, i) => (
            <span key={f.id}>{i > 0 && ', '}<Nombre fila={f} etiqueta={`${f.nombre}${f.detalle ? `, ${f.detalle}` : ''}, sin alumnos en riesgo`} className="text-primary-ink underline" /></span>
          ))}.
        </p>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">Un alumno puede tener varios motivos; por eso las cifras por motivo no suman el total.</p>
    </div>
  )
}
