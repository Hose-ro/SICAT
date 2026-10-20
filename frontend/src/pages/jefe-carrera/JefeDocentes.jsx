import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fechaHoraCorta, periodoTexto, plural } from './supervision/formato'
import MapaDocentes from './graficas/MapaDocentes'
import { JefaturaPage, Segmento, Vacio, linkClass, selectClass } from './supervision/ui'

function cobertura(d) {
  return d.clasesEsperadas ? `${d.cobertura} %` : 'No aplica'
}

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
  cobertura: { label: 'Menor cobertura primero', comparar: (a, b) => (a.clasesEsperadas ? a.cobertura : 101) - (b.clasesEsperadas ? b.cobertura : 101) },
}

function Cifra({ label, value, alerta, detalle }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-[0.9375rem] font-semibold tabular-nums', alerta ? 'text-warning-foreground' : 'text-foreground')}>
        {value}
        {detalle && <span className="ml-1 text-xs font-normal text-muted-foreground">{detalle}</span>}
      </dd>
    </div>
  )
}

function TarjetaDocente({ d, j }) {
  const materias = materiasDe(d.asignaciones)
  const grupos = d.asignaciones.length
  return (
    <li className="flex flex-col rounded-[var(--radius-item)] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {d.periodoReferencia
            ? <Link className={cn(linkClass, 'text-[0.9375rem] text-foreground')} to={j.to(`/jefe-carrera/docentes/${d.id}`, { periodo: d.periodoReferencia })}>{d.nombre}</Link>
            : <span className="text-[0.9375rem] font-medium text-foreground">{d.nombre}</span>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {plural(materias.length, 'materia', 'materias')} · {plural(grupos, 'grupo', 'grupos')}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          Última captura
          <span className="block text-foreground">{d.tieneMetricas ? fechaHoraCorta(d.ultimaCaptura) : '—'}</span>
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border py-3 sm:grid-cols-4">
        <Cifra label="Horas / semana" value={d.tieneMetricas ? d.horasSemanales : '—'} />
        <Cifra label="Listas pendientes" value={d.tieneMetricas ? d.listasPendientes : '—'} alerta={d.listasPendientes > 0} />
        <Cifra label="Calif. pendientes" value={d.tieneMetricas ? d.calificacionesPendientes : '—'} alerta={d.calificacionesPendientes > 0} />
        <Cifra
          label="Cobertura"
          value={d.tieneMetricas ? cobertura(d) : '—'}
          detalle={d.tieneMetricas && d.clasesEsperadas > 0 ? `${d.listasCompletas}/${d.clasesEsperadas}` : null}
        />
      </dl>

      <ul className="mt-3 space-y-2 text-[0.8125rem]" aria-label={`Materias de ${d.nombre}`}>
        {materias.map((m) => (
          <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="min-w-0 text-foreground">{m.nombre}</span>
            <span className="flex flex-wrap gap-1">
              {m.grupos.map((g) => {
                const otroPeriodo = g.periodoConsulta && g.periodoConsulta !== j.periodo
                return (
                  <span
                    key={g.id}
                    title={otroPeriodo ? `Grupo de ${periodoTexto(g.periodoConsulta)}` : undefined}
                    className={cn('rounded-md border border-border px-1.5 py-px text-xs tabular-nums', otroPeriodo ? 'border-dashed text-muted-foreground' : 'bg-muted text-foreground')}
                  >
                    {g.nombre}{otroPeriodo && ` · ${periodoTexto(g.periodoConsulta)}`}
                  </span>
                )
              })}
            </span>
          </li>
        ))}
      </ul>
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
            <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
              Aparecen quienes tienen materias en grupos activos de la carrera. Las cifras corresponden a {periodoTexto(j.periodo)}; los grupos con borde punteado son de otro periodo.
              {' '}<b className="font-medium text-foreground">Cobertura</b> = listas completas entre clases ya concluidas con lista esperada; no cuentan suspensiones, clases sin inscritos ni calendarios sin configurar. Es evidencia de captura en SICAT, no de asistencia del docente.
            </p>

            {!docentesActivos.length ? (
              <Vacio titulo="Sin docentes asignados">Ninguna materia de los grupos activos de la carrera tiene docente.</Vacio>
            ) : !filas.length ? (
              <Vacio titulo={filtro ? 'Sin pendientes detectados' : 'Ningún docente coincide'} accion={<Button variant="outline" onClick={() => setParams(new URLSearchParams({ carrera: j.carreraId, periodo: j.periodo }), { replace: true })}>Restablecer filtros</Button>} />
            ) : vista === 'semanas' ? (
              <MapaDocentes j={j} resumen={resumen} docentes={filas} />
            ) : (
              <ul aria-label="Docentes de la carrera" className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {filas.map((d) => <TarjetaDocente key={d.id} d={d} j={j} />)}
              </ul>
            )}
          </>
        )
      }}
    </JefaturaPage>
  )
}
