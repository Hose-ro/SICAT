import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Chip } from '@/components/Chip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import IncorporarAlumno from './supervision/IncorporarAlumno'
import UnidadesOferta from './supervision/UnidadesOferta'
import { ESTADO_UNIDAD, MOTIVOS_RIESGO, estadoClase, senalUnidad, textoCierre } from './supervision/estados'
import { esDeLaParidad, fechaCorta, haceTiempo, modalidadTexto, plural, semestreTexto, diasTexto } from './supervision/formato'
import { Promedio } from './supervision/notas'
import { reintentarReportes, resumenAlumno, useReportes } from './supervision/useReportes'
import { BotonSeguimiento } from './supervision/Seguimiento'
import { Aviso, Cifra, JefaturaPage, Pestanas, Vacio, linkClass } from './supervision/ui'

const TABS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'alumnos', label: 'Alumnos' },
  { value: 'unidades', label: 'Unidades y calificaciones' },
]

export default function JefeMateriaDetalle() {
  const { id } = useParams()
  return (
    <JefaturaPage titulo={(r) => r.reticula.find((m) => m.id === Number(id))?.nombre} volver={{ to: '/jefe-carrera/materias', label: 'Materias' }}>
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} materiaId={Number(id)} />}
    </JefaturaPage>
  )
}

/**
 * Detalle canónico de una materia impartida: materia + grupo + periodo. Una
 * misma materia puede darse en varios grupos; el grupo elegido vive en la URL
 * (?oferta=<grupoId>) y cada sección se abre directamente (?tab=).
 */
function Contenido({ j, resumen, materiaId }) {
  const [params] = useSearchParams()
  const [incorporando, setIncorporando] = useState(null)
  const materia = resumen.reticula.find((m) => m.id === materiaId)
  const ofertas = useMemo(() => resumen.ofertas
    .filter((o) => o.materia.id === materiaId)
    .sort((a, b) => a.grupo.semestre - b.grupo.semestre || a.grupo.nombre.localeCompare(b.grupo.nombre, 'es')), [resumen.ofertas, materiaId])
  const elegida = ofertas.find((o) => String(o.grupo.id) === params.get('oferta')) ?? ofertas[0] ?? null
  // Solo el reporte del grupo elegido: cambiar de sección no vuelve a pedirlo.
  const pares = useMemo(() => (elegida ? [{ materiaId, grupoId: elegida.grupo.id }] : []), [elegida, materiaId])
  const reportes = useReportes(j, pares)
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'resumen'

  if (!materia) return <Aviso titulo="Materia fuera de la carrera">La materia no pertenece a la carrera seleccionada. <Link className={linkClass} to={j.to('/jefe-carrera/materias')}>Volver a Materias</Link></Aviso>

  const enlace = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, String(v)); else next.delete(k) })
    return `?${next}`
  }
  const estado = elegida ? reportes[`${materiaId}:${elegida.grupo.id}`] : null

  return (
    <>
      <p className="mt-3 text-[0.8125rem] text-muted-foreground">
        {materia.clave} · {semestreTexto(materia.semestre)} de la retícula · {materia.numUnidades} unidades
        {!esDeLaParidad(materia.semestre, j.periodo) && ofertas.length > 0 && ' · se imparte fuera de su ciclo'}
      </p>
      {j.historico && <p className="mt-2 text-xs text-muted-foreground">Periodo histórico: la consulta está disponible; la incorporación solo se hace en el periodo actual.</p>}

      {!elegida ? (
        <Vacio titulo="Sin grupo en el periodo">
          Esta materia está en la retícula, pero no se imparte en ningún grupo activo en {j.periodo}. El catálogo se edita desde Materias › Retícula.
        </Vacio>
      ) : (
        <>
          {ofertas.length > 1 && (
            <nav aria-label="Grupo de la materia" className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Se imparte en {ofertas.length} grupos:</span>
              {ofertas.map((o) => (
                <Link
                  key={o.id}
                  to={enlace({ oferta: o.grupo.id })}
                  aria-current={o.id === elegida.id ? 'true' : undefined}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[0.8125rem] text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=true]:border-primary/50 aria-[current=true]:bg-accent aria-[current=true]:font-medium md:min-h-9"
                >
                  {o.grupo.nombre}
                  <span className="text-xs text-muted-foreground">{modalidadTexto(o.grupo.modalidad)}</span>
                </Link>
              ))}
            </nav>
          )}

          <Encabezado j={j} o={elegida} onIncorporar={() => setIncorporando(elegida)} />

          <Pestanas
            label="Secciones de la materia en el grupo"
            activa={tab}
            items={TABS.map((t) => ({ ...t, to: enlace({ tab: t.value === 'resumen' ? null : t.value }), count: t.value === 'alumnos' ? elegida.resumen.alumnos : undefined }))}
          />

          {tab === 'resumen' && <Resumen j={j} o={elegida} resumen={resumen} enlace={enlace} />}
          {tab === 'alumnos' && <Alumnos j={j} o={elegida} estado={estado} />}
          {tab === 'unidades' && <UnidadesOferta oferta={elegida} estado={estado} />}
        </>
      )}

      {incorporando && <IncorporarAlumno j={j} oferta={incorporando} onClose={() => setIncorporando(null)} />}
    </>
  )
}

function Encabezado({ j, o, onIncorporar }) {
  const caso = { tipo: 'CALIFICACIONES_PENDIENTES', materiaId: o.materia.id, grupoId: o.grupo.id }
  return (
    <section aria-labelledby={`oferta-${o.id}`} className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        <h2 id={`oferta-${o.id}`} className="text-base font-semibold text-foreground">
          Grupo <Link className={cn(linkClass, 'text-foreground')} to={j.toDesde(`/jefe-carrera/grupos/${o.grupo.id}`)}>{o.grupo.nombre}</Link>
          <span className="ml-2 text-xs font-normal text-muted-foreground">{modalidadTexto(o.grupo.modalidad)} · {semestreTexto(o.grupo.semestre)}</span>
        </h2>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          {o.docentes.length ? o.docentes.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link className={linkClass} to={j.toDesde(`/jefe-carrera/docentes/${d.id}`)}>{d.nombre}</Link></span>) : <span className="text-warning-foreground">Sin docente asignado</span>}
        </p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {o.horarios.length ? o.horarios.map((h) => `${diasTexto(h.dias)} ${h.horaInicio}–${h.horaFin}${h.aula ? ` · ${h.aula.nombre}` : ''}`).join(' | ') : <span className="text-warning-foreground">Sin horario publicado</span>}
        </p>
        {o.cierre && <p className="mt-1 text-xs font-medium text-foreground">{textoCierre(o.cierre)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {o.resumen.calificacionesPendientes > 0 && (
          <BotonSeguimiento j={j} caso={caso} titulo={`${o.materia.nombre} · Grupo ${o.grupo.nombre}`} contexto={plural(o.resumen.calificacionesPendientes, 'calificación de unidad cerrada sin capturar', 'calificaciones de unidades cerradas sin capturar')} size="default" />
        )}
        {!j.historico && (
          <Button variant="outline" onClick={onIncorporar} className="min-h-11"><UserPlus aria-hidden="true" /> Incorporar alumno</Button>
        )}
      </div>
    </section>
  )
}

function Resumen({ j, o, resumen, enlace }) {
  const listas = resumen.pendientes
    .filter((c) => c.materia.id === o.materia.id && c.grupo.id === o.grupo.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Cifra label="Alumnos inscritos" value={o.resumen.alumnos} />
        <Cifra label="En riesgo" value={o.resumen.alumnosRiesgo} tono={o.resumen.alumnosRiesgo ? 'text-warning-foreground' : undefined} />
        <Cifra label="Calificaciones pendientes" value={o.resumen.calificacionesPendientes} tono={o.resumen.calificacionesPendientes ? 'text-warning-foreground' : undefined} />
        <Cifra label="Entregas por revisar" value={o.resumen.entregasPendientes} />
      </dl>

      <section aria-labelledby="materia-unidades" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 id="materia-unidades" className="text-sm font-semibold text-foreground">Unidades</h3>
          <Link className={cn(linkClass, 'inline-flex min-h-11 items-center text-[0.8125rem] md:min-h-0')} to={enlace({ tab: 'unidades' })}>Ver calificaciones por unidad</Link>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Estado de las unidades">
          {o.unidades.map((u) => {
            const info = ESTADO_UNIDAD[u.status] ?? ESTADO_UNIDAD.PENDIENTE
            return <li key={u.id}><Chip tone={senalUnidad(u) ? 'warning' : info.tono}>{u.nombre} · {info.label}</Chip></li>
          })}
          {o.docentes.length > 1 && <li className="self-center text-xs text-muted-foreground">Unidades de la materia, compartidas por sus docentes</li>}
        </ul>
        {/* Las señales van aparte para no desalinear la fila de unidades. */}
        {o.unidades.some((u) => senalUnidad(u)) && (
          <ul className="mt-2 space-y-0.5 text-xs text-warning-foreground">
            {o.unidades.filter((u) => senalUnidad(u)).map((u) => <li key={u.id}>{u.nombre}: {senalUnidad(u)}</li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="materia-listas" className="mt-8">
        <h3 id="materia-listas" className="text-sm font-semibold text-foreground">Listas sin captura completa</h3>
        {listas.length ? (
          <ul className="mt-2 divide-y divide-border border-y border-border text-[0.8125rem]">
            {listas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="text-foreground first-letter:uppercase">{fechaCorta(c.fecha)}, {c.horaInicio}</span>
                  <span className={cn('block text-xs', estadoClase(c.estado).texto)}>{c.estado === 'CAPTURA_PARCIAL' ? `Captura parcial (${c.registros} de ${c.alumnos})` : estadoClase(c.estado).label} · {haceTiempo(c.fecha)}</span>
                </span>
                <Link className={`${linkClass} text-xs`} to={j.toDesde('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined })}>Ver clase</Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 border-y border-border py-3 text-[0.8125rem] text-muted-foreground">Sin listas pendientes de esta materia en el grupo.</p>}
      </section>
    </>
  )
}

function Alumnos({ j, o, estado }) {
  const reporte = estado?.data
  if (estado?.error) {
    return (
      <p role="alert" className="mt-6 flex flex-wrap items-center gap-2 text-sm text-warning-foreground">
        No disponible: {estado.error}.
        <Button variant="outline" size="sm" onClick={reintentarReportes}>Reintentar</Button>
      </p>
    )
  }
  if (!reporte) return <div className="mt-6 h-24 animate-pulse rounded-[var(--radius-item)] bg-muted motion-reduce:animate-none" aria-busy="true" />
  const alumnos = new Map()
  ;(reporte.rows ?? []).forEach((row) => alumnos.set(row.alumno.id, [...(alumnos.get(row.alumno.id) ?? []), row]))
  if (!alumnos.size) return <Vacio titulo="Sin inscripciones aceptadas">Ningún alumno tiene esta materia aceptada en el grupo.</Vacio>

  return (
    <div role="region" tabIndex={0} aria-label={`Alumnos de ${o.materia.nombre}, grupo ${o.grupo.nombre}`} className="mt-6 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
      <table className="w-full min-w-[680px] border-collapse text-[0.8125rem]">
        <thead>
          <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-medium">Alumno</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Semestre</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Promedio</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Asistencia</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Señales</th>
          </tr>
        </thead>
        <tbody>
          {[...alumnos.entries()].map(([id, filas]) => {
            const r = resumenAlumno(filas)
            const alumno = filas[0].alumno
            return (
              <tr key={id} className="border-b border-border align-top last:border-b-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  <Link className={cn(linkClass, 'text-foreground')} to={j.toDesde(`/jefe-carrera/grupos/${o.grupo.id}`, { tab: 'alumnos', alumno: id })}>{alumno.nombre}</Link>
                  <span className="block text-xs font-normal tabular-nums text-muted-foreground">{alumno.numeroControl}</span>
                </th>
                <td className="px-4 py-2.5 text-muted-foreground">{alumno.semestre ? semestreTexto(alumno.semestre) : '—'}</td>
                <td className="px-4 py-2.5 text-right"><Promedio r={r} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.asistencia.porcentaje == null ? 'Sin registros' : `${r.asistencia.porcentaje} % · ${r.asistencia.faltas} F · ${r.asistencia.retardos} R · ${r.asistencia.justificadas} J`}</td>
                <td className="px-4 py-2.5 text-xs">{r.motivos.length ? <span className="text-warning-foreground">{r.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · ')}</span> : <span className="text-muted-foreground">Sin señales detectadas</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
