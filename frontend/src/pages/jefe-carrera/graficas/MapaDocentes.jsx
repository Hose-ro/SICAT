import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { modalidadTexto, plural } from '../supervision/formato'
import { linkClass } from '../supervision/ui'
import { META, coberturaPorDocente, semanasDe } from './cobertura'
import { posicionTooltip } from '@/components/graficas/util'
import '@/components/graficas/graficas.css'

// Escala divergente alrededor de la meta: dos pasos debajo, gris cerca, dos arriba.
const CLASES = [
  { hasta: 70, color: 'var(--viz-rojo-lejos)', texto: 'Menos de 70 %' },
  { hasta: 85, color: 'var(--viz-rojo-cerca)', texto: '70 a 84 %' },
  { hasta: META, color: 'var(--viz-neutro)', texto: `85 a ${META - 1} %` },
  { hasta: 100, color: 'var(--viz-azul-cerca)', texto: `${META} a 99 %` },
  { hasta: Infinity, color: 'var(--viz-azul-lejos)', texto: '100 %' },
]
const clase = (v) => CLASES.find((c) => v < c.hasta) ?? CLASES.at(-1)

/**
 * Cobertura de captura por docente y semana: rojo debajo de la meta, azul en
 * la meta o arriba. Cada celda abre el horario de esa semana filtrado por el
 * docente, donde está la evidencia clase por clase. Las filas llegan ya
 * filtradas y ordenadas por la página.
 */
export default function MapaDocentes({ j, resumen, docentes }) {
  const [tabla, setTabla] = useState(false)
  const cobertura = resumen.coberturaSemanal
  const semanas = useMemo(() => semanasDe(cobertura), [cobertura])
  const porDocente = useMemo(() => coberturaPorDocente(cobertura), [cobertura])

  if (!cobertura) {
    return <p className="mt-6 border-y border-border py-6 text-sm text-muted-foreground">La vista por semana estará disponible cuando el servidor se actualice.</p>
  }
  const filas = docentes.filter((d) => porDocente.has(d.id)).map((d) => ({ ...d, ...porDocente.get(d.id) }))
  const sinClases = docentes.length - filas.length

  return (
    <div className="viz mt-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="text-foreground">Cobertura de la semana</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {CLASES.map((c) => <span key={c.texto} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: c.color }} />{c.texto}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="viz-cell--vacia size-2.5 rounded-[3px] border border-border" />Sin clases con lista esperada</span>
        </span>
        <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem] text-foreground">
          <input type="checkbox" checked={tabla} onChange={(e) => setTabla(e.target.checked)} className="size-[17px] accent-primary" />
          Ver como tabla
        </label>
      </div>

      {!filas.length ? (
        <p className="mt-4 border-y border-border py-6 text-sm text-muted-foreground">Ningún docente de esta lista tiene clases concluidas con lista esperada en el periodo.</p>
      ) : tabla ? <Tabla filas={filas} semanas={semanas} /> : <Mapa j={j} filas={filas} semanas={semanas} />}

      <p className="mt-3 text-xs text-muted-foreground">
        La línea vertical de «Periodo» marca la meta de {META} %. Las celdas rayadas no tenían clases con lista esperada, por ejemplo una semana sin sábado en Mixto o con suspensión.
        {sinClases > 0 && ` ${plural(sinClases, 'docente de la lista no aparece', 'docentes de la lista no aparecen')} porque no tiene clases concluidas con lista esperada en el periodo.`}
      </p>
    </div>
  )
}

function Mapa({ j, filas, semanas }) {
  // El tooltip vive fuera del área con scroll horizontal para que no lo recorte.
  const marco = useRef(null)
  const contenedor = useRef(null)
  // Celda activa por teclado o puntero: [fila, semana].
  const [activa, setActiva] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0, arriba: false })

  const mostrar = (f, c, el) => {
    const caja = marco.current.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    // En la mitad inferior se abre hacia arriba, para no salir de la tabla.
    const arriba = f >= filas.length / 2
    setPos({ x: posicionTooltip(r.right - caja.left, caja.width, 240), y: arriba ? r.top - caja.top - 6 : r.bottom - caja.top + 6, arriba })
    setActiva([f, c])
  }
  const mover = (e, f, c) => {
    const pasos = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]
    if (e.key === 'Escape') { setActiva(null); return }
    if (!pasos) return
    e.preventDefault()
    const nf = Math.max(0, Math.min(filas.length - 1, f + pasos[0]))
    const nc = Math.max(0, Math.min(semanas.length - 1, c + pasos[1]))
    contenedor.current.querySelector(`[data-celda="${nf}-${nc}"]`)?.focus()
  }
  const d = activa ? filas[activa[0]] : null
  const s = d ? d.semanas[activa[1]] : null
  const sem = activa ? semanas[activa[1]] : null
  const maxPend = Math.max(1, ...filas.map((x) => x.acumulado.sinCompleta))

  return (
    <div ref={marco} className="relative mt-4">
    <div ref={contenedor} className="viz-plot overflow-x-auto pb-1" onPointerLeave={() => setActiva(null)} onScroll={() => setActiva(null)}>
      <table className="viz-heat text-[0.8125rem]">
        <caption className="sr-only">Cobertura de captura por docente y semana. Usa las flechas para recorrer las celdas; cada celda abre el horario de esa semana.</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 z-[1] bg-background pb-2 pr-4 text-left font-medium">Docente</th>
            {semanas.map((w, c) => (
              <th key={w.lunes} scope="col" className={cn('min-w-11 whitespace-nowrap pb-2 text-center font-medium tabular-nums', activa?.[1] === c && 'text-foreground')}>
                {w.etiqueta}
                {w.enCurso && <span className="block font-normal">en curso</span>}
              </th>
            ))}
            <th scope="col" className="pb-2 pl-5 text-left font-medium">Periodo</th>
            <th scope="col" className="pb-2 pl-3 text-right font-medium">Sin captura completa</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((x, f) => (
            <tr key={x.id}>
              <th scope="row" className="sticky left-0 z-[1] bg-background pr-4 text-left font-normal">
                <Link className={cn(linkClass, 'whitespace-nowrap text-foreground', activa?.[0] === f && 'underline')} to={j.to(`/jefe-carrera/docentes/${x.id}`)}>{x.nombre}</Link>
                <span className="block whitespace-nowrap text-xs text-muted-foreground">{x.modalidades.map(modalidadTexto).join(' y ')}</span>
              </th>
              {x.semanas.map((c, k) => {
                const vacia = c.cobertura == null
                const enFoco = activa?.[0] === f && activa?.[1] === k
                const w = semanas[k]
                return (
                  <td key={w.lunes}>
                    <Link
                      to={j.to('/jefe-carrera/horarios', { vista: 'semana', fecha: w.lunes, docente: x.id, modalidad: x.modalidades.length === 1 && x.modalidades[0] === 'MIXTO' ? 'MIXTO' : undefined })}
                      tabIndex={f === 0 && k === 0 ? 0 : -1}
                      data-celda={`${f}-${k}`}
                      data-activo={enFoco ? '' : undefined}
                      aria-label={vacia ? `${x.nombre}, semana del ${w.rango}: sin clases con lista esperada. Abrir horario.` : `${x.nombre}, semana del ${w.rango}: ${c.cobertura} %, ${c.completas} de ${c.esperadas} listas completas. Abrir horario.`}
                      className={cn('viz-cell', vacia && 'viz-cell--vacia', w.enCurso && 'opacity-60')}
                      style={vacia ? undefined : { background: clase(c.cobertura).color }}
                      onPointerEnter={(e) => mostrar(f, k, e.currentTarget)}
                      onFocus={(e) => mostrar(f, k, e.currentTarget)}
                      onBlur={() => setActiva(null)}
                      onKeyDown={(e) => mover(e, f, k)}
                    />
                  </td>
                )
              })}
              <td className="pl-5">
                <span className="flex items-center gap-2.5">
                  <svg width="96" height="10" aria-hidden="true" className="shrink-0">
                    <rect x="0" y="4" width="96" height="2" rx="1" fill="var(--viz-grid)" />
                    <rect x="0" y="1" width={Math.max(4, (96 * (x.acumulado.cobertura ?? 0)) / 100)} height="8" rx="3" fill={x.acumulado.cobertura < META ? 'var(--viz-rojo-lejos)' : 'var(--viz-serie)'} />
                    <line x1={(96 * META) / 100} x2={(96 * META) / 100} y1="0" y2="10" stroke="var(--viz-meta)" strokeWidth="1.5" />
                  </svg>
                  <span className="w-11 text-right tabular-nums text-foreground">{x.acumulado.cobertura == null ? '—' : `${x.acumulado.cobertura} %`}</span>
                </span>
              </td>
              <td className="pl-3 text-right tabular-nums">
                <span className="inline-flex items-center justify-end gap-2">
                  <span aria-hidden="true" className="h-2 rounded-full bg-[var(--viz-apagado-activo)]" style={{ width: `${(28 * x.acumulado.sinCompleta) / maxPend}px` }} />
                  <span className={x.acumulado.sinCompleta ? 'text-foreground' : 'text-muted-foreground'}>{x.acumulado.sinCompleta}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

      <div className="viz-tooltip" data-oculto={s ? undefined : ''} style={{ left: pos.x, top: pos.y, width: 240, transform: pos.arriba ? 'translateY(-100%)' : undefined }} role="status" aria-live="polite">
        {s && <>
          <div className="text-muted-foreground">{d.nombre} · semana del {sem.rango}{sem.enCurso ? ' (en curso)' : ''}</div>
          {s.cobertura == null ? <div className="mt-1">Sin clases con lista esperada</div> : <>
            <div className="mt-1.5"><span className="viz-key viz-key--caja" style={{ background: clase(s.cobertura).color }} /><b>{s.cobertura} %</b> <span className="text-muted-foreground">de cobertura</span></div>
            <div className="text-muted-foreground">{s.completas} de {s.esperadas} listas completas{s.tardias ? `, ${plural(s.tardias, 'tardía', 'tardías')}` : ''}</div>
            {s.sinCompleta > 0 && <div className="text-muted-foreground">{[s.sinCaptura && `${s.sinCaptura} sin captura`, s.parciales && plural(s.parciales, 'parcial', 'parciales')].filter(Boolean).join(' · ')}</div>}
          </>}
          {s.suspendidas > 0 && <div className="mt-1 text-xs text-muted-foreground">{plural(s.suspendidas, 'clase suspendida', 'clases suspendidas')}; no cuentan.</div>}
          <div className="mt-1.5 text-xs text-primary-ink">Abre el horario de esa semana</div>
        </>}
      </div>
    </div>
  )
}

function Tabla({ filas, semanas }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
        <caption className="sr-only">Cobertura de captura por docente y semana, en porcentaje</caption>
        <thead>
          <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-medium">Docente</th>
            {semanas.map((w) => <th key={w.lunes} scope="col" className="px-2 py-2.5 text-right font-medium">{w.etiqueta}</th>)}
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Periodo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((x) => (
            <tr key={x.id} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-foreground">{x.nombre}</th>
              {x.semanas.map((c, k) => <td key={semanas[k].lunes} className={cn('px-2 py-2.5 text-right tabular-nums', c.cobertura != null && c.cobertura < META ? 'font-semibold' : 'text-muted-foreground')}>{c.cobertura == null ? '—' : c.cobertura}</td>)}
              <td className="px-4 py-2.5 text-right tabular-nums">{x.acumulado.cobertura == null ? '—' : `${x.acumulado.cobertura} %`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
