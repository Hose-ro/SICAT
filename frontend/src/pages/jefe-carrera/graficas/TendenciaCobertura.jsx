import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartColumn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { modalidadTexto, plural } from '../supervision/formato'
import { SeccionTitulo, Segmento, linkClass } from '../supervision/ui'
import { META, modalidadesCon, rachaDebajo, serieSemanal } from './cobertura'
import '../inicio.css'

/** Una escala fija y una sola medida: listas completas / clases elegibles. */
export default function TendenciaCobertura({ j, resumen }) {
  const [modalidadElegida, setModalidad] = useState('')
  const [tabla, setTabla] = useState(false)
  const [semanaElegida, setSemana] = useState(null)
  const nombre = useId()
  const scrollRef = useRef(null)
  const semanaRef = useRef(null)
  const cobertura = resumen.coberturaSemanal
  const modalidades = useMemo(() => modalidadesCon(cobertura), [cobertura])
  const modalidad = modalidades.includes(modalidadElegida) ? modalidadElegida : ''
  const serie = useMemo(() => serieSemanal(cobertura, modalidad), [cobertura, modalidad])
  const ultimaCerrada = serie.filter((s) => !s.enCurso && s.cobertura != null).at(-1)
  const seleccionada = serie.find((s) => s.lunes === semanaElegida)
    ?? ultimaCerrada ?? serie.findLast((s) => s.cobertura != null) ?? serie.at(-1)
  const hayDatos = serie.some((s) => s.cobertura != null)
  const racha = rachaDebajo(serie, serie)

  // Desplazar solo el gráfico: la semana elegida no debe mover toda la página.
  useEffect(() => {
    const contenedor = scrollRef.current
    const semana = semanaRef.current
    if (!contenedor || !semana) return undefined
    const centrar = () => { contenedor.scrollLeft = semana.offsetLeft - (contenedor.clientWidth - semana.offsetWidth) / 2 }
    centrar()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(centrar)
    observer.observe(contenedor)
    return () => observer.disconnect()
  }, [seleccionada?.lunes, serie.length, tabla])

  if (!cobertura) return null

  return (
    <section aria-labelledby={`${nombre}-titulo`} className="registro-asistencias mt-10">
      <SeccionTitulo
        id={`${nombre}-titulo`}
        titulo="Registro de asistencias"
        descripcion="Clases con lista completa, por semana."
        accion={<Link className={cn(linkClass, 'inline-flex min-h-11 items-center text-sm')} to={j.to('/jefe-carrera/docentes', { vista: 'semanas' })}>Ver por docente</Link>}
      />
      <div className="registro-controles">
        {modalidades.length > 1 && (
          <Segmento label="Modalidad de la tendencia" value={modalidad} onChange={setModalidad} options={[{ value: '', label: 'Todas' }, ...modalidades.map((m) => ({ value: m, label: modalidadTexto(m) }))]} />
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={tabla} onChange={(e) => setTabla(e.target.checked)} className="size-[17px] accent-primary" />
          Ver como tabla
        </label>
      </div>
      {!hayDatos ? (
        <div className="inicio-tendencia-vacia"><ChartColumn className="inicio-icono" aria-hidden="true" /><p>Todavía no hay clases concluidas con lista esperada para esta modalidad en el periodo.</p></div>
      ) : (
        <>
          <p className="registro-conclusion">
            {ultimaCerrada
              ? <>Última semana cerrada, {ultimaCerrada.rango}: <strong>{ultimaCerrada.completas} de {ultimaCerrada.esperadas} listas completas ({ultimaCerrada.cobertura} %)</strong>. {ultimaCerrada.cobertura >= META ? 'Meta alcanzada.' : `Por debajo de la meta de ${META} %.`}</>
              : 'La primera semana sigue en curso. Su resultado puede cambiar hasta que termine.'}
            {racha >= 2 && ` Van ${racha} semanas cerradas evaluables seguidas por debajo de la meta.`}
          </p>
          {tabla ? <TablaSemanas serie={serie} /> : (
            <>
              <p id={`${nombre}-ayuda`} className="registro-ayuda">Selecciona una semana para ver sus cifras. En móvil, desliza la gráfica para recorrer el periodo.</p>
              <div className="registro-grafica">
                <div className="registro-eje" aria-hidden="true">
                  {[100, 75, 50, 25, 0].map((valor) => <span key={valor} style={{ bottom: `${valor}%` }}>{valor} %</span>)}
                </div>
                <div ref={scrollRef} className="registro-scroll" tabIndex={0} role="region" aria-label="Gráfica semanal de listas completas">
                  <div className="registro-semanas" role="radiogroup" aria-label="Semana del registro de asistencias" aria-describedby={`${nombre}-ayuda`}>
                    <div className="registro-rejilla" aria-hidden="true">
                      {[0, 25, 50, 75, 100].map((valor) => <span key={valor} style={{ bottom: `${valor}%` }} />)}
                      <div className="registro-meta" style={{ bottom: `${META}%` }}><span>Meta {META} %</span></div>
                    </div>
                    {serie.map((s) => (
                      <label key={s.lunes} ref={seleccionada.lunes === s.lunes ? semanaRef : null} className={cn('registro-semana', seleccionada.lunes === s.lunes && 'registro-semana-elegida')}>
                        <input type="radio" name={`${nombre}-semana`} className="sr-only" checked={seleccionada.lunes === s.lunes} onChange={() => setSemana(s.lunes)}
                          aria-label={`Semana del ${s.rango}${s.enCurso ? ', en curso' : ''}: ${s.cobertura == null ? 'sin clases concluidas con lista esperada' : `${s.completas} de ${s.esperadas} listas completas, ${s.cobertura} %`}`} />
                        <span className="registro-porcentaje" aria-hidden="true">{s.cobertura == null ? '—' : `${s.cobertura} %`}</span>
                        <span className="registro-pista" aria-hidden="true">
                          {s.cobertura != null && <span className={cn('registro-barra', s.enCurso && 'registro-barra-actual')} style={{ height: `${s.cobertura}%` }} />}
                          {s.cobertura === 0 && <span className="registro-cero" />}
                        </span>
                        <span className="registro-fecha" aria-hidden="true">{s.etiqueta}<span>{s.enCurso ? 'En curso' : s.cobertura == null ? 'Sin clases' : s.cobertura < META ? 'Bajo la meta' : ''}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DetalleSemana semana={seleccionada} j={j} modalidad={modalidad} />
            </>
          )}
        </>
      )}
      <p className="registro-nota">Se cuentan solo las clases concluidas con lista esperada. Las suspendidas no entran en el cálculo. Las listas completas incluyen las registradas tarde. Este registro no confirma la presencia física del docente.</p>
    </section>
  )
}

function DetalleSemana({ semana: s, j, modalidad }) {
  return (
    <div className="registro-detalle" role="status" aria-live="polite" aria-atomic="true">
      <div className="registro-detalle-titulo">
        <h3>Semana del {s.rango}</h3>
        <span>{s.cobertura == null ? (s.enCurso ? 'En curso · sin clases evaluables todavía' : 'Sin clases evaluables') : s.enCurso ? 'En curso · resultado provisional' : s.cobertura >= META ? 'Meta alcanzada' : `Debajo de la meta de ${META} %`}</span>
      </div>
      <dl className="registro-cifras">
        <div><dt>Listas completas</dt><dd>{s.completas} de {s.esperadas}</dd></div>
        <div><dt>Sin completar</dt><dd>{s.sinCompleta}<span>{s.sinCaptura} sin captura · {plural(s.parciales, 'parcial', 'parciales')}</span></dd></div>
        <div><dt>Registradas tarde</dt><dd>{s.tardias}</dd></div>
        <div><dt>Clases suspendidas</dt><dd>{s.suspendidas}</dd></div>
      </dl>
      <Link className={cn(linkClass, 'inline-flex min-h-11 items-center text-sm')} to={j.to('/jefe-carrera/horarios', { vista: 'semana', fecha: s.lunes, modalidad: modalidad || undefined })}>Ver clases de esta semana</Link>
    </div>
  )
}

function TablaSemanas({ serie }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[var(--radius-item)] border border-border" tabIndex={0} role="region" aria-label="Datos semanales del registro de asistencias">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Registro de asistencias por semana</caption>
        <thead>
          <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
            {['Semana', 'Clases evaluables', 'Listas completas', 'Sin completar', 'Registradas tarde', 'Suspendidas', 'Listas completas (%)'].map((titulo, i) => <th key={titulo} scope="col" className={cn('px-4 py-3 font-medium', i > 0 && 'text-right')}>{titulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {serie.map((s) => (
            <tr key={s.lunes} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-3 text-left font-medium">{s.rango}{s.enCurso && <span className="block text-xs font-normal text-muted-foreground">En curso · provisional</span>}</th>
              {[s.esperadas, s.completas, s.sinCompleta, s.tardias, s.suspendidas].map((valor, i) => <td key={i} className="px-4 py-3 text-right tabular-nums">{valor}</td>)}
              <td className="px-4 py-3 text-right tabular-nums">{s.cobertura == null ? 'Sin clases evaluables' : `${s.cobertura} %`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
