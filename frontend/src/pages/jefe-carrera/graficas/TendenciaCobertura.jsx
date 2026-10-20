import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartColumn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { modalidadTexto, plural } from '../supervision/formato'
import { SeccionTitulo, Segmento, linkClass } from '../supervision/ui'
import { META, modalidadesCon, serieSemanal } from './cobertura'
import { posicionTooltip, useAncho } from './util'
import './graficas.css'

const M = { izq: 44, der: 78, arriba: 14 }
const ALTO_LINEA = 180
const SEPARACION = 58
const ALTO_COLUMNAS = 84
const BANDA_X = 40

/** Columna con 4px redondeados en el extremo de datos y esquina recta en la base. */
function columna(x, ancho, base, tope) {
  const r = Math.min(4, (base - tope) / 2, ancho / 2)
  if (base - tope < 0.5) return `M${x},${base} h${ancho} v0 h${-ancho} Z`
  return `M${x},${base} V${tope + r} Q${x},${tope} ${x + r},${tope} H${x + ancho - r} Q${x + ancho},${tope} ${x + ancho},${tope + r} V${base} Z`
}

/**
 * Tendencia de captura en Inicio: cobertura semanal frente a la meta y, en el
 * mismo eje de semanas, las listas sin captura completa. Sale de las mismas
 * clases que los indicadores; la vista de tabla da cada valor sin el tooltip.
 */
export default function TendenciaCobertura({ j, resumen }) {
  const [modalidad, setModalidad] = useState('')
  const [tabla, setTabla] = useState(false)
  const cobertura = resumen.coberturaSemanal
  const modalidades = useMemo(() => modalidadesCon(cobertura), [cobertura])
  const serie = useMemo(() => serieSemanal(cobertura, modalidad).map((s) => ({
    ...s,
    nota: s.enCurso
      ? 'Semana en curso: solo cuentan las clases ya concluidas.'
      : s.suspendidas ? `${plural(s.suspendidas, 'clase suspendida', 'clases suspendidas')}; no cuentan como pendientes.` : null,
  })), [cobertura, modalidad])

  // Un servidor sin el agregado semanal todavía no ofrece la gráfica.
  if (!cobertura) return null
  const cerradas = serie.filter((s) => !s.enCurso && s.cobertura != null)
  const ultima = cerradas.at(-1)
  let debajo = 0
  for (let i = cerradas.length - 1; i >= 0 && cerradas[i].cobertura < META; i--) debajo++

  return (
    <section aria-labelledby="tendencia-captura" className="viz inicio-card inicio-tendencia">
      <SeccionTitulo
        id="tendencia-captura"
        titulo="Tendencia de captura"
        descripcion={`Listas completas entre clases ya concluidas con lista esperada, por semana; la meta es ${META} %. Es evidencia de registro en SICAT, no de asistencia del docente.`}
        accion={<Link className={cn(linkClass, 'inline-flex min-h-11 items-center text-[0.8125rem]')} to={j.to('/jefe-carrera/docentes', { vista: 'semanas' })}>Ver por docente</Link>}
      />
      {!serie.some((s) => s.cobertura != null) ? (
        <div className="inicio-tendencia-vacia"><ChartColumn className="inicio-icono" aria-hidden="true" /><p>Todavía no hay clases concluidas con lista esperada en el periodo.</p></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {modalidades.length > 1 && (
              <Segmento label="Modalidad de la tendencia" value={modalidad} onChange={setModalidad} options={[{ value: '', label: 'Todas' }, ...modalidades.map((m) => ({ value: m, label: modalidadTexto(m) }))]} />
            )}
            <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.8125rem] text-foreground">
              <input type="checkbox" checked={tabla} onChange={(e) => setTabla(e.target.checked)} className="size-[17px] accent-primary" />
              Ver como tabla
            </label>
          </div>
          <p className="mt-3 max-w-3xl text-[0.9375rem] leading-relaxed text-foreground">
            {ultima
              ? `La semana del ${ultima.etiqueta} cerró en ${ultima.cobertura} % de listas completas${ultima.cobertura < META ? `, debajo de la meta de ${META} %` : ', dentro de la meta'}.`
              : 'Todavía no hay semanas cerradas con clases esperadas.'}
            {debajo >= 2 && ` Van ${debajo} semanas seguidas debajo de la meta.`}
          </p>
          {tabla ? <TablaSemanas serie={serie} /> : <Grafica serie={serie} />}
        </>
      )}
    </section>
  )
}

function Grafica({ serie }) {
  const [ref, ancho] = useAncho()
  const [activa, setActiva] = useState(null)

  const plotAncho = Math.max(0, ancho - M.izq - M.der)
  const paso = serie.length ? plotAncho / serie.length : 0
  const cx = (i) => M.izq + paso * i + paso / 2
  const compacto = paso < 56

  const valores = serie.map((s) => s.cobertura).filter((v) => v != null)
  const piso = Math.max(0, Math.min(Math.floor((Math.min(...valores, META) - 5) / 10) * 10, 80))
  const yL = (v) => M.arriba + ((100 - v) / (100 - piso)) * ALTO_LINEA
  const ticksL = []
  for (let v = piso; v <= 100; v += 10) ticksL.push(v)

  const baseC = M.arriba + ALTO_LINEA + SEPARACION + ALTO_COLUMNAS
  const maxC = Math.max(4, ...serie.map((s) => s.sinCompleta))
  const topeC = Math.ceil(maxC / 4) * 4
  const yC = (v) => baseC - (v / topeC) * ALTO_COLUMNAS
  const anchoBarra = Math.min(24, paso * 0.5)
  const masAlta = serie.reduce((m, s, i) => (s.sinCompleta > serie[m].sinCompleta ? i : m), 0)
  const alto = baseC + BANDA_X

  const puntos = serie.map((s, i) => (s.cobertura == null ? null : [cx(i), yL(s.cobertura)]))
  const conValor = puntos.map((p, i) => [p, i]).filter(([p]) => p)
  const cerrados = conValor.filter(([, i]) => !serie[i].enCurso)
  const trazo = (lista) => lista.map(([p], k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const enCurso = conValor.find(([, i]) => serie[i].enCurso)
  const ultimoCerrado = cerrados.at(-1)

  const elegir = (evento) => {
    const caja = evento.currentTarget.getBoundingClientRect()
    const x = evento.clientX - caja.left
    if (x < M.izq - 10 || x > M.izq + plotAncho + 10) { setActiva(null); return }
    setActiva(Math.max(0, Math.min(serie.length - 1, Math.floor((x - M.izq) / paso))))
  }
  const teclado = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActiva((i) => Math.min(serie.length - 1, (i ?? -1) + 1)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setActiva((i) => Math.max(0, (i ?? serie.length) - 1)) }
    else if (e.key === 'Escape') setActiva(null)
  }
  const s = activa == null ? null : serie[activa]

  return (
    <div
      ref={ref}
      className="viz-plot mt-5"
      tabIndex={0}
      role="slider"
      aria-label="Semana de la gráfica de cobertura. Usa las flechas izquierda y derecha para recorrer las semanas."
      aria-valuemin={1}
      aria-valuemax={serie.length}
      aria-valuenow={(activa ?? serie.length - 1) + 1}
      aria-valuetext={(() => { const x = serie[activa ?? serie.length - 1]; return `Semana del ${x.rango}: ${x.cobertura == null ? 'sin clases' : `${x.cobertura} % de cobertura`}, ${x.sinCompleta} sin captura completa` })()}
      onPointerMove={elegir}
      onPointerLeave={() => setActiva(null)}
      onKeyDown={teclado}
      onBlur={() => setActiva(null)}
    >
      {ancho > 0 && (
        <svg width={ancho} height={alto} aria-hidden="true">
          {/* Cuadrícula y eje del gráfico de línea */}
          {ticksL.map((v) => (
            <g key={v}>
              <line x1={M.izq} x2={M.izq + plotAncho} y1={yL(v)} y2={yL(v)} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={M.izq - 10} y={yL(v)} dy="0.32em" textAnchor="end" className="viz-tick">{v === 100 ? '100 %' : v}</text>
            </g>
          ))}
          <line x1={M.izq} x2={M.izq + plotAncho} y1={yL(META)} y2={yL(META)} stroke="var(--viz-meta)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
          <text x={M.izq + plotAncho + 10} y={yL(META)} dy="0.32em" className="viz-label-2">Meta {META} %</text>

          {/* Columna activa: la semana elegida se marca en ambos gráficos */}
          {s && <rect x={cx(activa) - paso / 2} y={M.arriba} width={paso} height={baseC - M.arriba} fill="var(--viz-serie-wash)" />}

          {/* El atributo SVG d mantiene el trazo visible también sin soporte de d en CSS. */}
          <g className="viz-revelar">
            <path className="viz-morph" d={trazo(cerrados)} fill="none" stroke="var(--viz-serie)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {enCurso && ultimoCerrado && (
              <path className="viz-morph" d={`M${ultimoCerrado[0][0].toFixed(1)},${ultimoCerrado[0][1].toFixed(1)} L${enCurso[0][0].toFixed(1)},${enCurso[0][1].toFixed(1)}`} fill="none" stroke="var(--viz-serie)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" opacity="0.7" />
            )}
            {conValor.map(([p, i]) => (
              <g key={i} className="viz-pos" style={{ transform: `translate(${p[0]}px, ${p[1]}px)` }}>
                <circle r={activa === i ? 6 : 4} fill={serie[i].enCurso ? 'var(--viz-surface)' : 'var(--viz-serie)'} stroke={serie[i].enCurso ? 'var(--viz-serie)' : 'var(--viz-surface)'} strokeWidth="2" />
              </g>
            ))}
          </g>
          {ultimoCerrado && (
            <text x={ultimoCerrado[0][0]} y={ultimoCerrado[0][1] - 14} textAnchor="middle" className="viz-label">{serie[ultimoCerrado[1]].cobertura} %</text>
          )}
          {/* La etiqueta va del lado contrario a la línea que llega: abajo si la semana cae, arriba si sube. */}
          {enCurso && <text x={enCurso[0][0]} y={enCurso[0][1] + (ultimoCerrado && enCurso[0][1] > ultimoCerrado[0][1] ? 22 : -14)} textAnchor="middle" className="viz-label-2">en curso</text>}

          {/* Segundo gráfico, mismo eje de semanas: listas sin captura o parciales */}
          <text x={M.izq} y={baseC - ALTO_COLUMNAS - 20} className="viz-label">Listas sin captura completa</text>
          {[0, topeC / 2, topeC].map((v) => (
            <g key={v}>
              <line x1={M.izq} x2={M.izq + plotAncho} y1={yC(v)} y2={yC(v)} stroke={v ? 'var(--viz-grid)' : 'var(--viz-axis)'} strokeWidth="1" />
              <text x={M.izq - 10} y={yC(v)} dy="0.32em" textAnchor="end" className="viz-tick">{v}</text>
            </g>
          ))}
          {serie.map((x, i) => (
            <path
              key={x.lunes}
              className="viz-morph"
              d={columna(cx(i) - anchoBarra / 2, anchoBarra, baseC, yC(x.sinCompleta))}
              fill={activa === i ? 'var(--viz-apagado-activo)' : 'var(--viz-apagado)'}
            />
          ))}
          {serie[masAlta].sinCompleta > 0 && activa !== masAlta && (
            <text x={cx(masAlta)} y={yC(serie[masAlta].sinCompleta) - 8} textAnchor="middle" className="viz-label-2">{serie[masAlta].sinCompleta}</text>
          )}

          {/* Eje X compartido */}
          {/* En pantallas angostas se alternan las etiquetas; la semana activa siempre se rotula. */}
          {serie.map((x, i) => (
            <g key={x.lunes}>
              {(!compacto || i % 2 === 0 || activa === i) && (
                <text x={cx(i)} y={baseC + 18} textAnchor="middle" className="viz-tick" fontWeight={activa === i ? 600 : undefined}>{x.etiqueta}</text>
              )}
              {x.suspendidas > 0 && !compacto && <text x={cx(i)} y={baseC + 33} textAnchor="middle" className="viz-label-2">{x.suspendidas === 1 ? '1 suspendida' : `${x.suspendidas} suspendidas`}</text>}
            </g>
          ))}
        </svg>
      )}

      {ancho > 0 && (
        <div
          className="viz-tooltip"
          data-oculto={s ? undefined : ''}
          style={{ left: s ? posicionTooltip(cx(activa), ancho) : 0, top: M.arriba }}
          role="status"
          aria-live="polite"
        >
          {s && <>
            <div className="text-muted-foreground">Semana del {s.rango}{s.enCurso ? ' · en curso' : ''}</div>
            <div className="mt-1.5"><span className="viz-key" style={{ background: 'var(--viz-serie)' }} /><b>{s.cobertura == null ? 'Sin clases' : `${s.cobertura} %`}</b> <span className="text-muted-foreground">de cobertura</span></div>
            <div className="text-muted-foreground">{s.completas} de {s.esperadas} listas completas{s.tardias ? `, ${s.tardias} ${s.tardias === 1 ? 'tardía' : 'tardías'}` : ''}</div>
            <div className="mt-1"><span className="viz-key viz-key--caja" style={{ background: 'var(--viz-apagado-activo)' }} /><b className="text-[13px]">{s.sinCompleta}</b> <span className="text-muted-foreground">sin captura completa</span></div>
            {s.nota && <div className="mt-1.5 text-xs text-muted-foreground">{s.nota}</div>}
          </>}
        </div>
      )}
    </div>
  )
}

function TablaSemanas({ serie }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
      <table className="w-full min-w-[560px] border-collapse text-[0.8125rem]">
        <caption className="sr-only">Cobertura de captura por semana</caption>
        <thead>
          <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-medium">Semana</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Esperadas</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Completas</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Sin captura completa</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Cobertura</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((s) => (
            <tr key={s.lunes} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-foreground">{s.rango}{s.enCurso && <span className="ml-2 text-xs font-normal text-muted-foreground">en curso</span>}{s.nota && <span className="block text-xs font-normal text-muted-foreground">{s.nota}</span>}</th>
              <td className="px-4 py-2.5 text-right tabular-nums">{s.esperadas}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{s.completas}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{s.sinCompleta}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${s.cobertura != null && s.cobertura < META ? 'font-semibold' : ''}`}>{s.cobertura == null ? '—' : `${s.cobertura} %`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
