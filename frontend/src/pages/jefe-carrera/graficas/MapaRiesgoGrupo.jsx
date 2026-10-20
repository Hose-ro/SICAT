import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarX2, FileX2 } from 'lucide-react'
import SexoBadge from '@/components/SexoBadge'
import { porcentajeAusencias, textoEntregas } from '@/lib/desempeno'
import { cn } from '@/lib/utils'
import { plural } from '../supervision/formato'
import { BotonSeguimiento } from '../supervision/Seguimiento'
import { MOTIVOS_RIESGO } from '../supervision/estados'
import { estadoConjunto, reintentarReportes } from '../supervision/useReportes'
import { AvisoParcial, Segmento, SeccionTitulo, Vacio, linkClass } from '../supervision/ui'
import { ESTADO_CELDA, conRiesgo, matrizRiesgo } from './riesgo'
import { posicionTooltip } from './util'
import './graficas.css'

const VISTAS = [
  { value: '', label: 'En riesgo' },
  { value: 'todos', label: 'Todos' },
]

const LEYENDA = ['REPROBADO', 'EN_RIESGO', 'APROBADO', 'SIN_CALIFICAR', 'NO_INSCRITO']

/** Motivos de una celda en palabras, con las cifras que los explican. */
function motivosCelda(c) {
  return c.motivos.map((m) => {
    if (m === 'ASISTENCIA') return `${porcentajeAusencias(c.asistencia) ?? 0} % de faltas y retardos`
    if (m === 'ENTREGAS') return textoEntregas({ vencidas: c.tareas.vencidas, sinEntregar: c.tareas.vencidasSinEntregar })
    return MOTIVOS_RIESGO[m] ?? m
  })
}

function etiquetaCelda(alumno, materia, c) {
  const estado = ESTADO_CELDA[c.estado].label.toLowerCase()
  if (c.estado === 'NO_INSCRITO') return `${alumno.nombre}, ${materia.nombre}: no inscrito.`
  if (c.estado === 'CARGANDO' || c.estado === 'NO_DISPONIBLE') return `${alumno.nombre}, ${materia.nombre}: ${estado}.`
  const promedio = c.promedio == null ? 'sin promedio' : `promedio ${c.promedio}`
  const motivos = motivosCelda(c)
  return `${alumno.nombre}, ${materia.nombre}: ${estado}, ${promedio}${motivos.length ? `. ${motivos.join('; ')}` : ''}. Abrir expediente.`
}

/**
 * Qué alumno está en riesgo y en qué materia. Cada celda es la peor unidad
 * del alumno en esa materia; el color solo aparece donde hay que actuar.
 */
export default function MapaRiesgoGrupo({ j, grupo, ofertas, reportes, expediente, abrirAlumno, alumnoActivo }) {
  const [params, setParams] = useSearchParams()
  const vista = params.get('ver') === 'todos' ? 'todos' : ''
  const setVista = (v) => { const n = new URLSearchParams(params); if (v) n.set('ver', v); else n.delete('ver'); setParams(n, { replace: true }) }

  const alumnos = expediente.data?.alumnos
  const conjunto = estadoConjunto(reportes, ofertas.map((o) => `${o.materia.id}:${grupo.id}`))
  const matriz = useMemo(() => (alumnos ? matrizRiesgo(alumnos, ofertas, reportes, grupo.id) : null), [alumnos, ofertas, reportes, grupo.id])

  if (expediente.error) return <Vacio titulo="No se pudo cargar el alumnado">{expediente.error}</Vacio>
  if (!matriz || (conjunto.cargando && !Object.values(reportes).some((r) => r.data))) {
    return <div className="mt-6 h-72 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" aria-label="Cargando el mapa de riesgo" />
  }
  if (!ofertas.length) return <Vacio titulo="Sin materias en el periodo">El grupo no tiene materias asignadas en este periodo.</Vacio>

  const enRiesgo = matriz.filas.filter((f) => f.enRiesgo > 0)
  const filas = vista === 'todos' ? matriz.filas : enRiesgo

  return (
    <section className="viz mt-6" aria-labelledby="mapa-riesgo">
      <SeccionTitulo
        id="mapa-riesgo"
        titulo="Alumnos en riesgo por materia"
        descripcion={`${plural(enRiesgo.length, 'alumno', 'alumnos')} de ${matriz.filas.length} con señales en alguna materia. Cada celda muestra el promedio del alumno en esa materia.`}
        accion={<Segmento label="Alumnos que se muestran" value={vista} onChange={setVista} options={VISTAS} />}
      />
      <AvisoParcial conjunto={conjunto} total={ofertas.length} onReintentar={reintentarReportes} />

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {LEYENDA.map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span className={cn('viz-muestra', ESTADO_CELDA[e].clase)} aria-hidden="true" />
            {ESTADO_CELDA[e].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><CalendarX2 className="size-3" aria-hidden="true" />Faltas y retardos</span>
        <span className="inline-flex items-center gap-1.5"><FileX2 className="size-3" aria-hidden="true" />Tareas sin entregar</span>
      </div>

      {filas.length ? (
        <Mapa j={j} matriz={matriz} filas={filas} abrirAlumno={abrirAlumno} alumnoActivo={alumnoActivo} />
      ) : (
        <Vacio titulo={conjunto.completo ? 'Nadie del grupo tiene señales de riesgo' : 'Sin señales en las materias consultadas'}>
          {conjunto.completo
            ? 'Ningún alumno tiene señales de riesgo en este periodo. Cambia a Todos para ver al grupo completo.'
            : 'Faltan materias por consultar; reintenta para confirmar.'}
        </Vacio>
      )}

      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        Una materia queda en riesgo si alguna de sus unidades lo está: calificación menor a 80, faltas y retardos de 30 % o más, o 30 % o más de las tareas vencidas sin entregar. Las tareas que todavía no vencen no cuentan.
      </p>
    </section>
  )
}

function Mapa({ j, matriz, filas, abrirAlumno, alumnoActivo }) {
  // El tooltip vive fuera del área con scroll horizontal para que no lo recorte.
  const marco = useRef(null)
  const contenedor = useRef(null)
  const [activa, setActiva] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0, arriba: false })
  const ANCHO = 260

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
      if (nf < 0 || nf >= filas.length || nc < 0 || nc >= matriz.columnas.length) return
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
  const columna = activa ? matriz.columnas[activa[1]] : null

  return (
    <div ref={marco} className="relative mt-4">
      <div ref={contenedor} role="region" tabIndex={-1} aria-label="Mapa de riesgo del grupo" className="viz-plot overflow-x-auto pb-1" onPointerLeave={() => setActiva(null)} onScroll={() => setActiva(null)}>
        <table className="viz-heat text-[0.8125rem]">
          <caption className="sr-only">Estado de cada alumno en cada materia del grupo. Usa las flechas para recorrer las celdas; cada celda abre el expediente del alumno.</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 z-[2] bg-background pb-2 pr-4 text-left align-bottom font-medium">Alumno</th>
              {matriz.columnas.map((col, c) => (
                <th key={col.id} scope="col" title={col.materia.nombre} className={cn('min-w-[52px] whitespace-nowrap px-0.5 pb-2 text-center align-bottom font-medium', activa?.[1] === c && 'text-foreground')}>
                  <span className="block text-foreground">{col.materia.clave || col.materia.nombre}</span>
                  <span className={cn('block font-normal tabular-nums', col.enRiesgo ? 'text-warning-foreground' : undefined)}>
                    {col.reporte.error ? 'No disponible' : col.enRiesgo ? `${col.enRiesgo} en riesgo` : 'Sin riesgo'}
                  </span>
                </th>
              ))}
              <th scope="col" className="pb-2 pl-4 text-left align-bottom font-medium">Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((x, f) => (
              <tr key={x.alumno.id}>
                <th scope="row" className="sticky left-0 z-[1] bg-background py-0.5 pr-4 text-left font-normal">
                  <span className="flex items-center gap-1.5">
                    <button type="button" onClick={() => abrirAlumno(x.alumno.id)} className={cn(linkClass, 'whitespace-nowrap text-left text-foreground', activa?.[0] === f && 'underline')}>{x.alumno.nombre}</button>
                    <SexoBadge sexo={x.alumno.sexo} />
                  </span>
                  <span className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {x.enRiesgo ? `${plural(x.enRiesgo, 'materia', 'materias')} en riesgo` : x.alumno.numeroControl ?? 'Sin señales'}
                  </span>
                </th>
                {x.celdas.map((c, k) => {
                  const col = matriz.columnas[k]
                  if (c.estado === 'NO_INSCRITO') {
                    return <td key={col.id}><span className="viz-riesgo viz-cell--vacia" role="img" aria-label={etiquetaCelda(x.alumno, col.materia, c)} /></td>
                  }
                  const glifos = c.motivos ?? []
                  return (
                    <td key={col.id}>
                      <button
                        type="button"
                        tabIndex={`${f}-${k}` === primera ? 0 : -1}
                        data-celda={`${f}-${k}`}
                        data-activo={alumnoActivo === x.alumno.id || (activa?.[0] === f && activa?.[1] === k) ? '' : undefined}
                        aria-label={etiquetaCelda(x.alumno, col.materia, c)}
                        className={cn('viz-riesgo', ESTADO_CELDA[c.estado].clase)}
                        onClick={() => abrirAlumno(x.alumno.id)}
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
                <td className="pl-4">
                  {x.enRiesgo > 0 && (
                    <BotonSeguimiento
                      j={j}
                      caso={{ tipo: 'ALUMNO_RIESGO', alumnoId: x.alumno.id }}
                      titulo={`Seguimiento de ${x.alumno.nombre}`}
                      contexto={matriz.columnas.filter((_, k) => conRiesgo(x.celdas[k].estado)).map((col) => col.materia.nombre).join(', ')}
                      className="whitespace-nowrap"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="viz-tooltip" data-oculto={celda ? undefined : ''} style={{ left: pos.x, top: pos.y, width: ANCHO, transform: pos.arriba ? 'translateY(-100%)' : undefined }} aria-hidden="true">
        {celda && (
          <>
            <div className="text-muted-foreground">{fila.alumno.nombre}</div>
            <div className="font-medium text-foreground">{columna.materia.nombre}</div>
            {celda.estado === 'CARGANDO' || celda.estado === 'NO_DISPONIBLE' ? (
              <div className="mt-1">{ESTADO_CELDA[celda.estado].label}</div>
            ) : (
              <>
                <div className="mt-1.5"><b>{celda.promedio ?? '—'}</b> <span className="text-muted-foreground">{celda.promedio == null ? 'sin promedio' : celda.tipo === 'REAL' ? 'promedio definitivo' : 'promedio provisional'}</span></div>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 tabular-nums">
                  <dt className="text-muted-foreground">Asistencia</dt>
                  <dd>{celda.asistencia.porcentaje == null ? 'Sin registros' : `${celda.asistencia.porcentaje} %`}</dd>
                  <dt className="text-muted-foreground">Entregas</dt>
                  <dd>{celda.tareas.vencidas ? `${celda.tareas.vencidas - celda.tareas.vencidasSinEntregar} de ${celda.tareas.vencidas} vencidas` : 'Ninguna vencida'}</dd>
                </dl>
                {celda.unidades.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
                    {celda.unidades.map((u) => (
                      <li key={u.nombre}><span className="font-medium">{u.nombre}:</span> {u.motivos.map((m) => (m === 'ENTREGAS' ? 'entregas' : (MOTIVOS_RIESGO[m] ?? m).toLowerCase())).join(', ')}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="mt-1.5 text-xs text-primary-ink">Abre el expediente</div>
          </>
        )}
      </div>
    </div>
  )
}
