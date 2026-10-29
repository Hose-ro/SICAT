import { Link, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { AnilloProgreso, AnilloSegmentos } from '@/components/graficas/Anillos'
import { tonoRegistro } from '@/components/graficas/util'
import { cn } from '@/lib/utils'
import HorarioCarrera from './supervision/HorarioCarrera'
import { ESTADOS_PENDIENTES, estadoClase } from './supervision/estados'
import { fechaCorta, fechaHoraCorta, haceTiempo, minutos, modalidadTexto, parseClave, diasTexto } from './supervision/formato'
import { useClases } from './supervision/useClasesSemana'
import { Aviso, JefaturaPage, SeccionTitulo, Vacio, linkClass } from './supervision/ui'
import EncabezadoDocente from './components/EncabezadoDocente'
import AvanceDocente from './components/AvanceDocente'

const fechaBreve = (clave) => parseClave(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

export default function JefeDocenteDetalle() {
  const { id } = useParams()
  return (
    <JefaturaPage titulo={(r) => r.docentes.find((d) => d.id === Number(id))?.nombre} encabezadoEnContenido volver={{ to: '/jefe-carrera/docentes', label: 'Docentes' }}>
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} docenteId={Number(id)} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen, docenteId }) {
  const docente = resumen.docentes.find((d) => d.id === docenteId)
  const { clases, error, reintentar } = useClases({
    carreraId: j.carreraId, periodo: j.periodo, desde: resumen.intervalo?.desde, hasta: resumen.intervalo?.hasta, docenteId,
  })
  if (!docente) {
    return <><h1 className="mt-4 text-2xl font-semibold">Docente</h1><Aviso titulo="Sin asignación en esta carrera">Este docente no imparte clases de la carrera en {j.periodo}. <Link className={linkClass} to={j.to('/jefe-carrera/docentes')}>Volver a Docentes</Link></Aviso></>
  }
  const ofertas = resumen.ofertas.filter((o) => docente.ofertas.includes(o.id))

  return (
    <>
      <EncabezadoDocente docente={docente} j={j} />

      <Carga ofertas={ofertas} docente={docente} j={j} />
      <Registro docente={docente} clases={clases} error={error} reintentar={reintentar} intervalo={resumen.intervalo} j={j} />
      <AvanceDocente key={`${j.carreraId}:${j.periodo}:${docenteId}`} ofertas={ofertas} j={j} />
      <HorarioCarrera j={j} resumen={resumen} fijo={{ docenteId }} titulo="Horario semanal" descripcion="Solo las clases de este docente en la carrera." headingId="horario-docente" />
    </>
  )
}

function horasBloque(h) {
  const dias = h.dias.split(',').map((d) => d.trim()).filter(Boolean).length
  return Math.max(0, minutos(h.horaFin) - minutos(h.horaInicio)) / 60 * dias
}

function Carga({ ofertas, docente, j }) {
  return (
    <section className="mt-8" aria-labelledby="carga-docente">
      <SeccionTitulo id="carga-docente" titulo="Carga académica" descripcion={`${docente.horasSemanales} horas a la semana, calculadas con la duración y los días de cada bloque.`} />
      {ofertas.length ? (
        <div role="region" tabIndex={0} aria-label="Carga académica" className="overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
          <table className="w-full min-w-[720px] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Materia</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Bloques</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Horas / semana</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscritos</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((o) => {
                const bloques = o.horarios.filter((h) => h.docenteId === docente.id)
                return (
                  <tr key={o.id} className="border-b border-border align-top last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      <Link className={cn(linkClass, 'text-foreground')} to={j.toDesde(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id })}>{o.materia.nombre}</Link>
                      {o.docentes.length > 1 && <span className="block text-xs font-normal text-muted-foreground">Compartida con {o.docentes.filter((d) => d.id !== docente.id).map((d) => d.nombre).join(', ')}</span>}
                    </th>
                    <td className="px-4 py-3"><Link className={linkClass} to={j.toDesde(`/jefe-carrera/grupos/${o.grupo.id}`)}>{o.grupo.nombre}</Link><span className="block text-xs text-muted-foreground">{modalidadTexto(o.grupo.modalidad)}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bloques.length ? bloques.map((h) => <span key={h.id} className="block tabular-nums">{diasTexto(h.dias)} · {h.horaInicio}–{h.horaFin}{h.aula ? ` · ${h.aula.nombre}` : ''}</span>) : 'Docente principal sin bloque de horario'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{Math.round(bloques.reduce((n, h) => n + horasBloque(h), 0) * 10) / 10}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.resumen.alumnos}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Vacio titulo="Sin carga en el periodo" />}
    </section>
  )
}

function Registro({ docente, clases, error, reintentar, intervalo, j }) {
  const elegibles = (clases ?? []).filter((c) => c.elegible)
  const cuenta = (estado) => elegibles.filter((c) => c.estado === estado).length
  const completas = cuenta('LISTA_COMPLETA') + cuenta('REGISTRO_TARDIO')
  const sinEvidencia = elegibles.filter((c) => ESTADOS_PENDIENTES.has(c.estado)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio))
  const pct = elegibles.length ? Math.round((completas / elegibles.length) * 100) : null
  const tonoPct = tonoRegistro(pct)
  // Tramos del segundo anillo, en el orden en que se dibujan.
  const estados = [
    { label: 'Lista completa a tiempo', valor: cuenta('LISTA_COMPLETA'), tono: 'success' },
    { label: 'Registro tardío', valor: cuenta('REGISTRO_TARDIO'), tono: 'success-suave' },
    { label: 'Captura parcial', valor: cuenta('CAPTURA_PARCIAL'), tono: 'warning' },
    { label: 'Sin evidencia de registro', valor: cuenta('SIN_CAPTURA'), tono: 'destructive' },
  ]

  return (
    <section className="mt-10" aria-labelledby="registro-docente">
      <SeccionTitulo
        id="registro-docente"
        titulo="Registro de clases y asistencia"
        descripcion={intervalo ? `Clases concluidas del ${fechaBreve(intervalo.desde)} al ${fechaBreve(intervalo.hasta)}, sin suspensiones ni días fuera del calendario.` : null}
      />
      {error && !clases ? <Aviso tono="error" titulo="No se pudo consultar el registro" accion={<button type="button" className={linkClass} onClick={reintentar}>Reintentar</button>}>{error}</Aviso> : !clases ? (
        <div className="h-24 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-5 rounded-[var(--radius-item)] border border-border bg-card p-5">
              <AnilloProgreso pct={pct} grosor={6} className="size-24 sm:size-28">
                <span>
                  <span className={cn('block text-[1.375rem] font-semibold leading-none tracking-tight tabular-nums', tonoPct ? `anillo-texto-${tonoPct}` : 'text-muted-foreground')}>{pct == null ? '—' : `${pct}%`}</span>
                  <span className="mt-1 block text-[0.6875rem] text-muted-foreground">registro</span>
                </span>
              </AnilloProgreso>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Registro de listas de asistencia</h3>
                <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                  {elegibles.length ? <><span className="font-semibold tabular-nums text-foreground">{completas} de {elegibles.length}</span> clases elegibles con lista completa.</> : 'Todavía no hay clases elegibles en el intervalo.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-[var(--radius-item)] border border-border bg-card p-5">
              <AnilloSegmentos segmentos={estados.map((e) => ({ valor: e.valor, tono: e.tono }))} grosor={6} className="size-24 sm:size-28">
                <span>
                  <span className="block text-[1.375rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">{elegibles.length}</span>
                  <span className="mt-1 block text-[0.6875rem] text-muted-foreground">{elegibles.length === 1 ? 'clase' : 'clases'}</span>
                </span>
              </AnilloSegmentos>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">Estado de las clases elegibles</h3>
                <dl className="mt-2 space-y-1.5 text-[0.8125rem]">
                  {estados.map((e) => (
                    <div key={e.tono} className="flex items-center gap-2">
                      <span className={cn('size-2.5 shrink-0 rounded-full', `anillo-punto-${e.tono}`)} aria-hidden="true" />
                      <dt className={cn('min-w-0 flex-1', e.valor ? 'text-foreground' : 'text-muted-foreground')}>{e.label}</dt>
                      <dd className={cn('font-semibold tabular-nums', e.valor ? 'text-foreground' : 'text-muted-foreground')}>{e.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">La falta de captura no prueba ausencia del docente; confírmala en una observación.</p>

          {sinEvidencia.length ? (
            <details className="plegable group mt-6" open={sinEvidencia.length <= 5}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md border-b border-border pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Clases sin evidencia de registro</h3>
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning-foreground dark:bg-warning/20">{sinEvidencia.length}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="group-open:hidden">Mostrar</span>
                  <span className="hidden group-open:inline">Ocultar</span>
                  <ChevronDown className="size-4 transition-transform duration-200 ease-[var(--ease)] group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </span>
              </summary>
              <ul className="divide-y divide-border border-b border-border text-[0.8125rem]">
                {sinEvidencia.slice(0, 15).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="text-foreground first-letter:uppercase">{fechaCorta(c.fecha)}, {c.horaInicio}</span>
                      <span className="text-muted-foreground"> · {c.materia.nombre} · {c.grupo.nombre}</span>
                      <span className={cn('block text-xs', estadoClase(c.estado).texto)}>{estadoClase(c.estado).label}{c.estado === 'CAPTURA_PARCIAL' ? ` (${c.registros} de ${c.alumnos})` : ''} · {haceTiempo(c.fecha)}</span>
                    </span>
                    <Link className={`${linkClass} text-xs`} to={j.to(`/jefe-carrera/docentes/${docente.id}`, { fecha: c.fecha, clase: c.id, vista: 'dia', modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined })}>Ver clase</Link>
                  </li>
                ))}
              </ul>
              {sinEvidencia.length > 15 && <p className="mt-2 text-xs text-muted-foreground">Se muestran las 15 más recientes de {sinEvidencia.length}.</p>}
            </details>
          ) : (
            <>
              <h3 className="mt-6 text-sm font-semibold text-foreground">Clases sin evidencia de registro</h3>
              <p className="mt-2 border-t border-border py-4 text-sm text-muted-foreground">Sin pendientes detectados en el intervalo.</p>
            </>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Última captura: {fechaHoraCorta(docente.ultimaCaptura)}</p>
        </>
      )}
    </section>
  )
}
