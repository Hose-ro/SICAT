import { useRef, useState } from 'react'
import { CalendarX2, FileX2 } from 'lucide-react'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import { ESTADO_CELDA, MOTIVO_CORTO, etiquetaCelda } from './riesgo'
import { posicionTooltip } from './util'
import './graficas.css'

const LEYENDA = ['REPROBADO', 'EN_RIESGO', 'APROBADO', 'SIN_CALIFICAR', 'NO_INSCRITO']
const ANCHO = 260

/** Colores y glifos del mapa; `estados` permite omitir los que no aplican. */
export function LeyendaRiesgo({ estados = LEYENDA, className }) {
  return (
    <div className={cn('viz flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}>
      {estados.map((e) => (
        <span key={e} className="inline-flex items-center gap-1.5">
          <span className={cn('viz-muestra', ESTADO_CELDA[e].clase)} aria-hidden="true" />
          {ESTADO_CELDA[e].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5"><CalendarX2 className="size-3" aria-hidden="true" />Faltas y retardos</span>
      <span className="inline-flex items-center gap-1.5"><FileX2 className="size-3" aria-hidden="true" />Tareas sin entregar</span>
    </div>
  )
}

/**
 * Matriz alumno × columna (materias en la jefatura, unidades para el docente).
 * Cada celda es un botón con el estado en color, el promedio y los glifos de
 * motivo; las flechas recorren la matriz y el tooltip explica la celda.
 *
 * - columnas: [{ id, titulo, nombre, detalle, detalleRiesgo }]
 * - filas: [{ alumno, celdas, enRiesgo }] ya ordenadas
 *
 * Dentro de una tarjeta, define --mapa-fondo para que la columna fija del
 * alumno tome su color al desplazarse.
 */
export default function MapaRiesgo({
  columnas,
  filas,
  caption,
  etiquetaRegion,
  accion,
  onCelda,
  onAlumno,
  subtituloFila,
  accionFila,
  encabezadoAccion,
  activa: activaExterna,
  mostrarUnidades = true,
}) {
  // El tooltip vive fuera del área con scroll horizontal para que no lo recorte.
  const marco = useRef(null)
  const contenedor = useRef(null)
  const [activa, setActiva] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0, arriba: false })

  const mostrar = (f, c, el) => {
    const caja = marco.current.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const arriba = f >= filas.length / 2 && filas.length > 3
    setPos({ x: posicionTooltip(r.right - caja.left, caja.width, ANCHO), y: arriba ? r.top - caja.top - 6 : r.bottom - caja.top + 6, arriba })
    setActiva([f, c])
  }
  // Flechas para recorrer la matriz; las celdas sin inscripción no reciben foco y se saltan.
  const mover = (e, f, c) => {
    const pasos = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]
    if (e.key === 'Escape') { setActiva(null); return }
    if (!pasos) return
    e.preventDefault()
    let [nf, nc] = [f, c]
    for (;;) {
      nf += pasos[0]
      nc += pasos[1]
      if (nf < 0 || nf >= filas.length || nc < 0 || nc >= columnas.length) return
      const el = contenedor.current.querySelector(`[data-celda="${nf}-${nc}"]`)
      if (el) { el.focus(); return }
    }
  }
  const primera = (() => {
    for (let f = 0; f < filas.length; f++) {
      const c = filas[f].celdas.findIndex((x) => x.estado !== 'NO_INSCRITO')
      if (c >= 0) return `${f}-${c}`
    }
    return null
  })()

  const fila = activa ? filas[activa[0]] : null
  const celda = fila ? fila.celdas[activa[1]] : null
  const columna = activa ? columnas[activa[1]] : null

  return (
    <div ref={marco} className="viz relative mt-4">
      <div ref={contenedor} role="region" tabIndex={-1} aria-label={etiquetaRegion} className="viz-plot overflow-x-auto pb-1" onPointerLeave={() => setActiva(null)} onScroll={() => setActiva(null)}>
        <table className="viz-heat text-[0.8125rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 z-[2] bg-[var(--mapa-fondo,var(--background))] pb-2 pr-4 text-left align-bottom font-medium">Alumno</th>
              {columnas.map((col, c) => (
                <th key={col.id} scope="col" title={col.nombre} className={cn('min-w-[52px] whitespace-nowrap px-0.5 pb-2 text-center align-bottom font-medium', activa?.[1] === c && 'text-foreground')}>
                  <span className="block text-foreground">{col.titulo}</span>
                  {col.detalle && <span className={cn('block font-normal tabular-nums', col.detalleRiesgo && 'text-warning-foreground')}>{col.detalle}</span>}
                </th>
              ))}
              {accionFila && <th scope="col" className="pb-2 pl-4 text-left align-bottom font-medium">{encabezadoAccion}</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((x, f) => (
              <tr key={x.alumno.id}>
                <th scope="row" className="sticky left-0 z-[1] bg-[var(--mapa-fondo,var(--background))] py-0.5 pr-4 text-left font-normal">
                  <span className="flex items-center gap-1.5">
                    {onAlumno
                      ? <button type="button" onClick={() => onAlumno(x)} className={cn('whitespace-nowrap text-left font-medium text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40', activa?.[0] === f && 'underline')}>{x.alumno.nombre}</button>
                      : <span className={cn('whitespace-nowrap text-foreground', activa?.[0] === f && 'underline underline-offset-4')}>{x.alumno.nombre}</span>}
                    <SexoBadge sexo={x.alumno.sexo} />
                  </span>
                  {subtituloFila && <span className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">{subtituloFila(x)}</span>}
                </th>
                {x.celdas.map((c, k) => {
                  const col = columnas[k]
                  if (c.estado === 'NO_INSCRITO') {
                    return <td key={col.id}><span className="viz-riesgo viz-cell--vacia" role="img" aria-label={etiquetaCelda(x.alumno.nombre, col.nombre, c, accion)} /></td>
                  }
                  const glifos = c.motivos ?? []
                  const resaltada = (activaExterna && activaExterna(x, k)) || (activa?.[0] === f && activa?.[1] === k)
                  return (
                    <td key={col.id}>
                      <button
                        type="button"
                        tabIndex={`${f}-${k}` === primera ? 0 : -1}
                        data-celda={`${f}-${k}`}
                        data-activo={resaltada ? '' : undefined}
                        aria-label={etiquetaCelda(x.alumno.nombre, col.nombre, c, accion)}
                        className={cn('viz-riesgo', ESTADO_CELDA[c.estado].clase)}
                        onClick={() => onCelda(x, k)}
                        onPointerEnter={(e) => mostrar(f, k, e.currentTarget)}
                        onFocus={(e) => mostrar(f, k, e.currentTarget)}
                        onBlur={() => setActiva(null)}
                        onKeyDown={(e) => mover(e, f, k)}
                      >
                        <span aria-hidden="true">{c.estado === 'CARGANDO' ? '…' : c.estado === 'NO_DISPONIBLE' ? '?' : c.promedio ?? '—'}</span>
                        {glifos.includes('ASISTENCIA') && <CalendarX2 aria-hidden="true" />}
                        {glifos.includes('ENTREGAS') && <FileX2 aria-hidden="true" />}
                      </button>
                    </td>
                  )
                })}
                {accionFila && <td className="pl-4">{accionFila(x)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="viz-tooltip" data-oculto={celda ? undefined : ''} style={{ left: pos.x, top: pos.y, width: ANCHO, transform: pos.arriba ? 'translateY(-100%)' : undefined }} aria-hidden="true">
        {celda && (
          <>
            <div className="text-muted-foreground">{fila.alumno.nombre}</div>
            <div className="font-medium text-foreground">{columna.nombre}</div>
            {celda.estado === 'CARGANDO' || celda.estado === 'NO_DISPONIBLE' ? (
              <div className="mt-1">{ESTADO_CELDA[celda.estado].label}</div>
            ) : (
              <>
                <div className="mt-1.5"><b>{celda.promedio ?? '—'}</b> <span className="text-muted-foreground">{celda.promedio == null ? 'sin calificación' : celda.tipo === 'REAL' ? 'definitiva' : 'provisional'}</span></div>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 tabular-nums">
                  <dt className="text-muted-foreground">Asistencia</dt>
                  <dd>{celda.asistencia.porcentaje == null ? 'Sin registros' : `${celda.asistencia.porcentaje} %`}</dd>
                  <dt className="text-muted-foreground">Entregas</dt>
                  <dd>{celda.tareas.vencidas ? `${celda.tareas.vencidas - celda.tareas.vencidasSinEntregar} de ${celda.tareas.vencidas} vencidas` : 'Ninguna vencida'}</dd>
                </dl>
                {celda.unidades.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
                    {celda.unidades.map((u) => (
                      <li key={u.nombre}>{mostrarUnidades && <span className="font-medium">{u.nombre}: </span>}{u.motivos.map((m) => MOTIVO_CORTO[m] ?? m).join(', ')}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="mt-1.5 text-xs text-primary-ink">{accion}</div>
          </>
        )}
      </div>
    </div>
  )
}
