import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { claveFecha, haceTiempo, horaCorta, periodoTexto, plural } from './supervision/formato'
import MapaDocentes from './graficas/MapaDocentes'
import { JefaturaPage, Segmento, Vacio, selectClass } from './supervision/ui'

const DEFINICION_REGISTRO = 'Listas completas entre clases ya concluidas con lista esperada. No cuentan suspensiones, clases sin inscritos ni calendarios sin configurar. Es evidencia de captura en SICAT, no de asistencia del docente.'

/** Asignaciones agrupadas por materia: cada materia una vez, con sus grupos. */
function materiasDe(asignaciones) {
  const porMateria = new Map()
  asignaciones.forEach((o) => {
    const m = porMateria.get(o.materia.id) ?? { ...o.materia, grupos: [] }
    m.grupos.push(o.grupo)
    porMateria.set(o.materia.id, m)
  })
  return [...porMateria.values()]
    .map((m) => ({ ...m, grupos: m.grupos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// Orden por urgencia: primero quien acumula más pendientes o lleva más tiempo sin capturar.
const ORDENES = {
  nombre: { label: 'Ordenar por nombre', comparar: () => 0 },
  pendientes: { label: 'Más pendientes primero', comparar: (a, b) => (b.listasPendientes + b.calificacionesPendientes + b.entregasPendientes) - (a.listasPendientes + a.calificacionesPendientes + a.entregasPendientes) },
  // Sin captura en el periodo va antes que una captura antigua; sin clases en el periodo, al final.
  captura: { label: 'Captura más antigua primero', comparar: (a, b) => (b.tieneMetricas - a.tieneMetricas) || (a.ultimaCaptura ?? '').localeCompare(b.ultimaCaptura ?? '') },
  cobertura: { label: 'Menor registro de listas primero', comparar: (a, b) => (a.clasesEsperadas ? a.cobertura : 101) - (b.clasesEsperadas ? b.cobertura : 101) },
}

// «Registro de listas»: listas completas entre clases concluidas con lista esperada (antes «Cobertura»).
const R = 24
const CIRCUNFERENCIA = 2 * Math.PI * R

// Semáforo del registro: al día ≥ 90 %, rezagado ≥ 50 %, crítico debajo.
const tonoRegistro = (pct) => (pct == null ? null : pct >= 90 ? 'success' : pct >= 50 ? 'warning' : 'destructive')

/** «hoy, 10:47», «ayer», «hace 3 días»: la frescura importa más que la fecha exacta. */
function capturaTexto(iso) {
  const hace = haceTiempo(claveFecha(new Date(iso)))
  return hace === 'Hoy' ? `hoy, ${horaCorta(iso)}` : hace.toLocaleLowerCase('es-MX')
}

/** Anillo de registro: el trazo se dibuja al entrar y el porcentaje queda al centro. */
function AnilloRegistro({ pct }) {
  const tono = tonoRegistro(pct)
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 56 56" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none" strokeWidth="5" className="stroke-muted" />
        {pct > 0 && (
          <circle
            cx="28" cy="28" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
            className={cn('docente-anillo', `docente-trazo-${tono}`)}
            style={{ '--vacio': CIRCUNFERENCIA, strokeDasharray: CIRCUNFERENCIA, strokeDashoffset: CIRCUNFERENCIA * (1 - Math.min(pct, 100) / 100) }}
          />
        )}
      </svg>
      <span className={cn('absolute inset-0 grid place-items-center text-[0.8125rem] font-semibold tabular-nums', tono ? `docente-tono-${tono}` : 'text-muted-foreground')}>
        <span className="sr-only">Registro de listas: </span>{pct == null ? '—' : `${pct}%`}
      </span>
    </div>
  )
}

/** Sólo lo que falta; si no falta nada, una sola marca de «Al día». */
function Pendientes({ d }) {
  const items = [
    [d.listasPendientes, 'lista', 'listas'],
    [d.calificacionesPendientes, 'calificación', 'calificaciones'],
    [d.entregasPendientes, 'entrega', 'entregas'],
  ].filter(([n]) => n > 0)
  if (!items.length) {
    return <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success-foreground"><span className="size-1.5 rounded-full bg-success" aria-hidden="true" />Al día</p>
  }
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Pendientes de ${d.nombre}`}>
      {items.map(([n, uno, varios]) => (
        <li key={uno} className="rounded-full bg-warning/15 px-2 py-0.5 text-xs tabular-nums text-warning-foreground dark:bg-warning/20">
          <span className="font-semibold">{n}</span> {n === 1 ? uno : varios}
        </li>
      ))}
    </ul>
  )
}

function TarjetaDocente({ d, j, i }) {
  const materias = materiasDe(d.asignaciones)
  const pct = d.tieneMetricas && d.clasesEsperadas ? d.cobertura : null
  return (
    <li className="docente-tarjeta relative flex flex-col rounded-[var(--radius-item)] border border-border bg-card p-5" style={{ '--i': i }}>
      <div className="flex items-center gap-4">
        <AnilloRegistro pct={pct} />
        <div className="min-w-0 flex-1">
          {/* El nombre cubre toda la tarjeta (enlace estirado); los grupos quedan por encima. */}
          {d.periodoReferencia
            ? <Link className="docente-estirado block truncate text-base font-semibold tracking-tight text-foreground outline-none" to={j.to(`/jefe-carrera/docentes/${d.id}`, { periodo: d.periodoReferencia })}>{d.nombre}</Link>
            : <span className="block truncate text-base font-semibold tracking-tight text-foreground">{d.nombre}</span>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {!d.tieneMetricas ? `Sin clases en ${periodoTexto(j.periodo)}` : (
              <>
                {d.clasesEsperadas ? `${d.listasCompletas} de ${d.clasesEsperadas} listas` : 'Sin clases concluidas'}
                {' · '}
                {d.ultimaCaptura ? `capturó ${capturaTexto(d.ultimaCaptura)}` : <span className="font-medium text-destructive-foreground">sin capturas aún</span>}
              </>
            )}
          </p>
          {d.tieneMetricas && <Pendientes d={d} />}
        </div>
        {d.periodoReferencia && <ChevronRight className="docente-flecha size-4 shrink-0 self-start text-muted-foreground" aria-hidden="true" />}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[0.8125rem]">
        <ul className="contents" aria-label={`Materias de ${d.nombre}`}>
          {materias.map((m) => (
            <li key={m.id} className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 text-muted-foreground">{m.nombre}</span>
              {m.grupos.map((g) => {
                const otroPeriodo = g.periodoConsulta && g.periodoConsulta !== j.periodo
                // Del periodo consultado, el grupo abre la materia en ese grupo; de otro periodo solo se nombra.
                return otroPeriodo ? (
                  <span key={g.id} title={`Grupo de ${periodoTexto(g.periodoConsulta)}`} className="rounded-md border border-dashed border-border px-1.5 py-px text-xs tabular-nums text-muted-foreground">
                    {g.nombre}<span className="sr-only"> · {periodoTexto(g.periodoConsulta)}</span>
                  </span>
                ) : (
                  <Link key={g.id} to={j.toDesde(`/jefe-carrera/materias/${m.id}`, { oferta: g.id })} aria-label={`${m.nombre}, grupo ${g.nombre}`} className="group/grupo relative z-[1] rounded-md text-xs font-medium tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {/* En táctil el enlace crece a 44 px; el chip visible sigue siendo pequeño. */}
                    <span className="rounded-md bg-muted px-1.5 py-px transition-colors duration-150 group-hover/grupo:bg-accent group-hover/grupo:text-primary-ink">{g.nombre}</span>
                  </Link>
                )
              })}
            </li>
          ))}
        </ul>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {plural(d.asignaciones.length, 'grupo', 'grupos')}{d.tieneMetricas && ` · ${d.horasSemanales} h/sem`}
        </span>
      </div>
    </li>
  )
}

export default function JefeDocentes() {
  const [params, setParams] = useSearchParams()
  const filtro = params.get('filtro') === 'pendientes' ? 'pendientes' : ''
  const busqueda = params.get('q') ?? ''
  const orden = ORDENES[params.get('orden')] ? params.get('orden') : 'nombre'
  const vista = params.get('vista') === 'semanas' ? 'semanas' : 'tarjetas'
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }

  return (
    <JefaturaPage titulo="Docentes" subtitulo="Carga académica y registro de cada docente dentro de esta carrera.">
      {({ j, resumen }) => {
        const ofertas = new Map((resumen.catalogo?.ofertas ?? resumen.ofertas).map((o) => [o.id, o]))
        const metricas = new Map(resumen.docentes.map((d) => [d.id, d]))
        const docentesActivos = resumen.catalogo?.docentes ?? resumen.docentes
        const q = busqueda.trim().toLocaleLowerCase()
        const filas = docentesActivos
          .map((docente) => {
            const metrica = metricas.get(docente.id)
            const asignaciones = docente.ofertas.map((id) => ofertas.get(id)).filter(Boolean)
            const periodoReferencia = asignaciones.some((o) => o.grupo.periodoConsulta === j.periodo)
              ? j.periodo
              : asignaciones.map((o) => o.grupo.periodoConsulta).find((periodo) => j.periodos.includes(periodo))
            return {
              ...docente,
              ...metrica,
              asignaciones,
              periodoReferencia,
              tieneMetricas: Boolean(metrica),
              listasPendientes: metrica?.listasPendientes ?? 0,
              calificacionesPendientes: metrica?.calificacionesPendientes ?? 0,
              entregasPendientes: metrica?.entregasPendientes ?? 0,
            }
          })
          .filter((d) => !q || d.nombre.toLocaleLowerCase().includes(q))
          .filter((d) => !filtro || d.listasPendientes || d.calificacionesPendientes || d.entregasPendientes)
          .sort((a, b) => ORDENES[orden].comparar(a, b) || a.nombre.localeCompare(b.nombre, 'es'))

        return (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Segmento label="Vista" value={vista} onChange={(v) => set('vista', v === 'tarjetas' ? '' : v)} options={[{ value: 'tarjetas', label: 'Tarjetas' }, { value: 'semanas', label: 'Por semana' }]} />
              <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
                <span className="sr-only">Buscar docente</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(e) => set('q', e.target.value)} placeholder="Buscar docente" className="h-11 w-full rounded-[0.7rem] border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
              <Segmento label="Mostrar" value={filtro} onChange={(v) => set('filtro', v)} options={[{ value: '', label: 'Todos' }, { value: 'pendientes', label: 'Con pendientes' }]} />
              <label className="w-full sm:w-60">
                <span className="sr-only">Ordenar docentes</span>
                <select value={orden} onChange={(e) => set('orden', e.target.value === 'nombre' ? '' : e.target.value)} className={selectClass}>
                  {Object.entries(ORDENES).map(([value, o]) => <option key={value} value={value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            {(filtro || q) && (
              <p role="status" className="mt-3 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                Mostrando {filas.length} de {docentesActivos.length} docentes · {[filtro && 'con pendientes', q && `nombre con «${busqueda.trim()}»`].filter(Boolean).join(' · ')}
                <Button variant="ghost" size="sm" className="max-md:min-h-11" onClick={() => setParams(new URLSearchParams({ carrera: j.carreraId, periodo: j.periodo, ...(vista !== 'tarjetas' ? { vista } : {}), ...(orden !== 'nombre' ? { orden } : {}) }), { replace: true })}>Quitar filtros</Button>
              </p>
            )}
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8">
                Cifras de {periodoTexto(j.periodo)} · <span className="underline decoration-dotted underline-offset-4">¿qué mide el registro de listas?</span>
              </summary>
              <p className="max-w-2xl pb-2 leading-relaxed">{DEFINICION_REGISTRO} Los grupos con borde punteado son de otro periodo.</p>
            </details>

            {!docentesActivos.length ? (
              <Vacio titulo="Sin docentes asignados">Ninguna materia de los grupos activos de la carrera tiene docente.</Vacio>
            ) : !filas.length ? (
              <Vacio titulo={filtro ? 'Sin pendientes detectados' : 'Ningún docente coincide'} accion={<Button variant="outline" onClick={() => setParams(new URLSearchParams({ carrera: j.carreraId, periodo: j.periodo }), { replace: true })}>Restablecer filtros</Button>} />
            ) : vista === 'semanas' ? (
              <MapaDocentes j={j} resumen={resumen} docentes={filas} />
            ) : (
              <ul aria-label="Docentes de la carrera" className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filas.map((d, i) => <TarjetaDocente key={d.id} d={d} j={j} i={i} />)}
              </ul>
            )}
          </>
        )
      }}
    </JefaturaPage>
  )
}
