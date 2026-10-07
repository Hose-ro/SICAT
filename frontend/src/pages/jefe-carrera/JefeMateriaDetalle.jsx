import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Chip } from '@/components/Chip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import IncorporarAlumno from './supervision/IncorporarAlumno'
import { ESTADO_UNIDAD, MOTIVOS_RIESGO } from './supervision/estados'
import { esDeLaParidad, modalidadTexto, semestreTexto, diasTexto } from './supervision/formato'
import { Promedio } from './supervision/notas'
import { resumenAlumno, useReportes } from './supervision/useReportes'
import { Aviso, Cifra, JefaturaPage, Vacio, linkClass } from './supervision/ui'

export default function JefeMateriaDetalle() {
  const { id } = useParams()
  return (
    <JefaturaPage titulo={(r) => r.reticula.find((m) => m.id === Number(id))?.nombre} volver={{ to: '/jefe-carrera/materias', label: 'Materias' }}>
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} materiaId={Number(id)} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen, materiaId }) {
  const [params] = useSearchParams()
  const [incorporando, setIncorporando] = useState(null)
  const materia = resumen.reticula.find((m) => m.id === materiaId)
  const ofertas = useMemo(() => resumen.ofertas.filter((o) => o.materia.id === materiaId), [resumen.ofertas, materiaId])
  const pares = useMemo(() => ofertas.map((o) => ({ materiaId, grupoId: o.grupo.id })), [ofertas, materiaId])
  const reportes = useReportes(j, pares)
  const resaltada = params.get('oferta')

  if (!materia) return <Aviso titulo="Materia fuera de la carrera">La materia no pertenece a la carrera seleccionada. <Link className={linkClass} to={j.to('/jefe-carrera/materias')}>Volver a Materias</Link></Aviso>

  return (
    <>
      <header className="mt-3 border-b border-border pb-5">
        <p className="text-[0.8125rem] text-muted-foreground">
          {materia.clave} · {semestreTexto(materia.semestre)} de la retícula · {materia.numUnidades} unidades
          {!esDeLaParidad(materia.semestre, j.periodo) && ofertas.length > 0 && ' · se imparte fuera de su ciclo'}
        </p>
      </header>
      {j.historico && <p className="mt-4 text-xs text-muted-foreground">Periodo histórico: la consulta está disponible; la incorporación solo se hace en el periodo actual.</p>}

      {ofertas.length ? ofertas.map((o) => (
        <Oferta key={o.id} j={j} oferta={o} estado={reportes[`${materiaId}:${o.grupo.id}`]} resaltada={String(o.grupo.id) === resaltada} onIncorporar={() => setIncorporando(o)} />
      )) : <Vacio titulo="Sin oferta en el periodo">Esta materia de la retícula no está asignada a ningún grupo activo en {j.periodo}.</Vacio>}

      {incorporando && <IncorporarAlumno j={j} oferta={incorporando} onClose={() => setIncorporando(null)} />}
    </>
  )
}

function Oferta({ j, oferta: o, estado, resaltada, onIncorporar }) {
  const ref = useRef(null)
  useEffect(() => { if (resaltada) ref.current?.scrollIntoView({ block: 'start' }) }, [resaltada])
  const reporte = estado?.data
  const alumnos = new Map()
  ;(reporte?.rows ?? []).forEach((row) => alumnos.set(row.alumno.id, [...(alumnos.get(row.alumno.id) ?? []), row]))

  return (
    <section ref={ref} aria-labelledby={`oferta-${o.id}`} className={cn('mt-6 scroll-mt-6 rounded-[var(--radius-card)] border bg-card p-5 sm:p-6', resaltada ? 'border-primary/40' : 'border-border')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={`oferta-${o.id}`} className="text-base font-semibold text-foreground">
            Grupo <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/grupos/${o.grupo.id}`)}>{o.grupo.nombre}</Link>
            <span className="ml-2 text-xs font-normal text-muted-foreground">{modalidadTexto(o.grupo.modalidad)} · {semestreTexto(o.grupo.semestre)}</span>
          </h3>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {o.docentes.length ? o.docentes.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link className={linkClass} to={j.to(`/jefe-carrera/docentes/${d.id}`)}>{d.nombre}</Link></span>) : <span className="text-warning-foreground">Sin docente asignado</span>}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {o.horarios.length ? o.horarios.map((h) => `${diasTexto(h.dias)} ${h.horaInicio}–${h.horaFin}${h.aula ? ` · ${h.aula.nombre}` : ''}`).join(' | ') : <span className="text-warning-foreground">Sin horario publicado</span>}
          </p>
        </div>
        {!j.historico && (
          <Button variant="outline" onClick={onIncorporar} className="min-h-11"><UserPlus aria-hidden="true" /> Incorporar alumno</Button>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Cifra label="Inscritos aceptados" value={o.resumen.alumnos} />
        <Cifra label="En riesgo" value={o.resumen.alumnosRiesgo} tono={o.resumen.alumnosRiesgo ? 'text-warning-foreground' : undefined} />
        <Cifra label="Calificaciones pendientes" value={o.resumen.calificacionesPendientes} />
        <Cifra label="Entregas por revisar" value={o.resumen.entregasPendientes} />
      </dl>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Unidades">
        {o.unidades.map((u) => {
          const info = ESTADO_UNIDAD[u.status] ?? ESTADO_UNIDAD.PENDIENTE
          return <li key={u.id}><Chip tone={info.tono}>{u.nombre} · {info.label}</Chip></li>
        })}
        {o.docentes.length > 1 && <li className="self-center text-xs text-muted-foreground">Unidades de la materia, compartidas por sus docentes</li>}
      </ul>

      <details className="group mt-5 border-t border-border pt-4" open={resaltada || undefined}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
          Alumnos inscritos
          <span className="text-xs font-normal text-primary-ink group-open:hidden">Mostrar</span>
          <span className="hidden text-xs font-normal text-primary-ink group-open:inline">Ocultar</span>
        </summary>
        {estado?.error ? <p role="alert" className="mt-2 text-sm text-destructive-foreground">{estado.error}</p> : !reporte ? (
          <div className="mt-2 h-24 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" />
        ) : alumnos.size ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-[0.8125rem]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">Alumno</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Semestre</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Promedio</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Asistencia</th>
                  <th scope="col" className="py-2 font-medium">Señales</th>
                </tr>
              </thead>
              <tbody>
                {[...alumnos.entries()].map(([id, filas]) => {
                  const r = resumenAlumno(filas)
                  const alumno = filas[0].alumno
                  return (
                    <tr key={id} className="border-t border-border align-top">
                      <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                        <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/grupos/${o.grupo.id}`, { tab: 'alumnos', alumno: id })}>{alumno.nombre}</Link>
                        <span className="block text-xs font-normal tabular-nums text-muted-foreground">{alumno.numeroControl}</span>
                      </th>
                      <td className="py-2.5 pr-4 text-muted-foreground">{alumno.semestre ? semestreTexto(alumno.semestre) : '—'}</td>
                      <td className="py-2.5 pr-4 text-right"><Promedio r={r} /></td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{r.asistencia.porcentaje == null ? 'Sin registros' : `${r.asistencia.porcentaje} % · ${r.asistencia.faltas} F · ${r.asistencia.retardos} R · ${r.asistencia.justificadas} J`}</td>
                      <td className="py-2.5 text-xs">{r.motivos.length ? <span className="text-warning-foreground">{r.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · ')}</span> : <span className="text-muted-foreground">Sin señales</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              <Link className={linkClass} to={j.to(`/jefe-carrera/grupos/${o.grupo.id}`, { tab: 'materias', materia: o.materia.id })}>Ver calificaciones y observaciones por unidad</Link>
            </p>
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">Sin inscripciones aceptadas.</p>}
      </details>
    </section>
  )
}
