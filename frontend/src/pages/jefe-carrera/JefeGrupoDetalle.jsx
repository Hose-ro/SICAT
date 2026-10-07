import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '@/api/axios'
import { Chip } from '@/components/Chip'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import AlumnoExpediente from './supervision/AlumnoExpediente'
import HorarioCarrera from './supervision/HorarioCarrera'
import { ESTADO_UNIDAD, MOTIVOS_RIESGO } from './supervision/estados'
import { modalidadTexto, semestreTexto } from './supervision/formato'
import { Nota, Promedio } from './supervision/notas'
import { mensajeError } from './supervision/useJefatura'
import { resumenAlumno, useReportes } from './supervision/useReportes'
import { Aviso, Cifra, JefaturaPage, Pestanas, SeccionTitulo, Vacio, linkClass, selectClass } from './supervision/ui'

const TABS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'alumnos', label: 'Alumnos' },
  { value: 'materias', label: 'Materias y unidades' },
  { value: 'horario', label: 'Horario' },
]

function useExpediente(j, grupoId) {
  const [estado, setEstado] = useState({})
  const { carreraId, periodo } = j
  const key = `${carreraId}|${periodo}|${grupoId}`
  useEffect(() => {
    if (!carreraId || !periodo) return undefined
    let vivo = true
    api.get(`/jefe-carrera/grupos/${grupoId}/expediente`, { params: { carreraId, periodo } })
      .then(({ data }) => { if (vivo) setEstado((s) => ({ ...s, [key]: { data } })) })
      .catch((error) => { if (vivo) setEstado((s) => ({ ...s, [key]: { error: mensajeError(error, 'No se pudo cargar el grupo') } })) })
    return () => { vivo = false }
  }, [carreraId, periodo, grupoId, key])
  return estado[key] ?? { cargando: true }
}

export default function JefeGrupoDetalle() {
  const { id } = useParams()
  return (
    <JefaturaPage
      titulo={(r) => { const grupo = r.grupos.find((g) => g.id === Number(id)); return grupo && `Grupo ${grupo.nombre}` }}
      subtitulo={(r) => { const grupo = r.grupos.find((g) => g.id === Number(id)); return grupo && `${semestreTexto(grupo.semestre)} · ${modalidadTexto(grupo.modalidad)}` }}
      volver={{ to: '/jefe-carrera/grupos', label: 'Grupos' }}
    >
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} grupoId={Number(id)} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen, grupoId }) {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'resumen'
  const grupo = resumen.grupos.find((g) => g.id === grupoId)
  const ofertas = useMemo(() => resumen.ofertas.filter((o) => o.grupo.id === grupoId), [resumen.ofertas, grupoId])
  const pares = useMemo(() => ofertas.map((o) => ({ materiaId: o.materia.id, grupoId })), [ofertas, grupoId])
  const reportes = useReportes(j, pares)
  const expediente = useExpediente(j, grupoId)
  const alumnoId = params.get('alumno')

  if (!grupo) {
    return <Aviso titulo="Grupo fuera del periodo">Este grupo no está activo en {j.periodo} para la carrera seleccionada. <Link className={linkClass} to={j.to('/jefe-carrera/grupos')}>Volver a Grupos</Link></Aviso>
  }

  const tabTo = (value) => {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    next.delete('clase')
    return `?${next}`
  }
  const abrirAlumno = (alumno) => { const next = new URLSearchParams(params); next.set('alumno', alumno); setParams(next) }
  const cerrarAlumno = () => { const next = new URLSearchParams(params); next.delete('alumno'); setParams(next, { replace: true }) }
  const alumnos = expediente.data?.alumnos ?? []
  const alumnoAbierto = alumnoId ? alumnos.find((a) => String(a.id) === alumnoId) ?? null : null

  return (
    <>
      <Pestanas label="Secciones del grupo" activa={tab} items={TABS.map((t) => ({ ...t, to: tabTo(t.value), count: t.value === 'alumnos' && expediente.data ? alumnos.length : t.value === 'materias' ? ofertas.length : undefined }))} />

      {tab === 'resumen' && <Resumen j={j} resumen={resumen} grupo={grupo} ofertas={ofertas} reportes={reportes} expediente={expediente} abrirAlumno={abrirAlumno} />}
      {tab === 'alumnos' && <Alumnos grupo={grupo} ofertas={ofertas} reportes={reportes} expediente={expediente} abrirAlumno={abrirAlumno} />}
      {tab === 'materias' && <MateriasUnidades j={j} ofertas={ofertas} reportes={reportes} />}
      {tab === 'horario' && <HorarioCarrera j={j} resumen={resumen} fijo={{ grupoId }} titulo={`Horario de ${grupo.nombre}`} descripcion="Las mismas vistas del horario general, solo con este grupo." />}

      <AlumnoExpediente j={j} alumno={alumnoAbierto} cargando={Boolean(alumnoId && expediente.cargando)} onClose={cerrarAlumno} />
    </>
  )
}

function unidadActual(reporte) {
  const unidades = reporte?.unidades ?? []
  return unidades.find((u) => u.status === 'ACTIVA') ?? null
}

function Resumen({ j, resumen, grupo, ofertas, reportes, expediente, abrirAlumno }) {
  const incorporados = (expediente.data?.alumnos ?? []).filter((a) => a.origen === 'INCORPORADO').length
  const listas = resumen.pendientes.filter((c) => c.grupo.id === grupo.id)
  const riesgos = resumen.riesgos.filter((a) => a.causas.some((c) => c.grupo.id === grupo.id))
  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-border pb-6 sm:grid-cols-3 lg:grid-cols-6">
        <Cifra label="Alumnos del grupo" value={grupo.alumnosBase} />
        <Cifra label="Incorporados de otros grupos" value={expediente.data ? incorporados : '—'} />
        <Cifra label="Materias" value={ofertas.length} />
        <Cifra label="Alumnos en riesgo" value={grupo.alumnosRiesgo} tono={grupo.alumnosRiesgo ? 'text-warning-foreground' : undefined} />
        <Cifra label="Listas por completar" value={listas.length} tono={listas.length ? 'text-warning-foreground' : undefined} />
        <Cifra label="Calificaciones pendientes" value={ofertas.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0)} />
      </dl>

      <section className="mt-8" aria-labelledby="grupo-materias">
        <SeccionTitulo id="grupo-materias" titulo="Materias y docentes" descripcion="La unidad actual pertenece a cada materia del grupo, no al alumno." />
        {ofertas.length ? (
          <div className="overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
            <table className="w-full min-w-[820px] border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Materia</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Docente</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Unidad actual</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Inscritos</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">En riesgo</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Calif. pendientes</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Entregas por revisar</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((o) => {
                  const reporte = reportes[`${o.materia.id}:${grupo.id}`]?.data
                  const actual = unidadActual(reporte)
                  const cerradas = (reporte?.unidades ?? []).filter((u) => u.status === 'FINALIZADA').length
                  return (
                    <tr key={o.id} className="border-b border-border last:border-b-0">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: grupo.id })}>{o.materia.nombre}</Link>
                        <span className="block text-xs font-normal text-muted-foreground">{o.materia.clave}</span>
                      </th>
                      <td className="px-4 py-3">
                        {o.docentes.length ? o.docentes.map((d) => <Link key={d.id} className={cn(linkClass, 'block')} to={j.to(`/jefe-carrera/docentes/${d.id}`)}>{d.nombre}</Link>) : <span className="text-muted-foreground">Sin docente asignado</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {reporte ? <>{actual?.nombre ?? 'Sin unidad en curso'}<span className="block text-xs">{cerradas} de {reporte.unidades.length} cerradas</span></> : '…'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.resumen.alumnos}</td>
                      <td className={cn('px-4 py-3 text-right tabular-nums', o.resumen.alumnosRiesgo ? 'font-semibold text-warning-foreground' : 'text-muted-foreground')}>{o.resumen.alumnosRiesgo}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.resumen.calificacionesPendientes}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.resumen.entregasPendientes}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <Vacio titulo="Sin materias en el periodo">El grupo no tiene materias asignadas en este periodo.</Vacio>}
      </section>

      <section className="mt-10" aria-labelledby="grupo-riesgo">
        <SeccionTitulo id="grupo-riesgo" titulo="Alumnos en riesgo" descripcion="Criterio vigente: calificación menor a 80 en una unidad abierta, o al menos 3 registros con 30 % o más de faltas y retardos." />
        {riesgos.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {riesgos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <button type="button" onClick={() => abrirAlumno(a.id)} className={cn(linkClass, 'text-left text-sm text-foreground')}>{a.nombre}</button>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.causas.filter((c) => c.grupo.id === grupo.id).map((c) => `${c.materia.nombre} (${c.unidad?.nombre ?? 'unidad'}): ${c.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(', ')}`).join(' · ')}
                  </p>
                </div>
                {a.numeroControl && <span className="text-xs tabular-nums text-muted-foreground">{a.numeroControl}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="border-t border-border py-5 text-sm text-muted-foreground">Sin alumnos con señales de riesgo en las materias del grupo.</p>}
      </section>
    </>
  )
}

function Alumnos({ grupo, ofertas, reportes, expediente, abrirAlumno }) {
  if (expediente.cargando && !expediente.data) return <div className="mt-6 h-64 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" />
  if (expediente.error) return <Aviso tono="error" titulo="No se pudo cargar el alumnado">{expediente.error}</Aviso>
  const alumnos = expediente.data.alumnos
  if (!alumnos.length) return <Vacio titulo="Sin alumnos">Ningún alumno pertenece al grupo ni está incorporado a sus materias en este periodo.</Vacio>
  const cargandoReportes = ofertas.some((o) => reportes[`${o.materia.id}:${grupo.id}`]?.cargando)

  return (
    <>
      <p className="mt-5 max-w-3xl text-xs text-muted-foreground">
        Promedio y asistencia consideran las materias de este grupo. El promedio es el de SICAT (media de las unidades con calificación) y se marca provisional mientras alguna unidad siga abierta. El expediente reúne todas sus inscripciones del periodo.
      </p>
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card">
        <table className="w-full min-w-[820px] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Alumno</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Número de control</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Pertenencia</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Promedio</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Asistencia</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Incidencias</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((alumno) => {
              const filas = ofertas.flatMap((o) => (reportes[`${o.materia.id}:${grupo.id}`]?.data?.rows ?? []).filter((r) => r.alumno.id === alumno.id))
              const r = resumenAlumno(filas)
              return (
                <tr key={alumno.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <button type="button" onClick={() => abrirAlumno(alumno.id)} className={cn(linkClass, 'min-h-8 text-left text-foreground')}>{alumno.nombre}</button>
                      <SexoBadge sexo={alumno.sexo} />
                    </span>
                  </th>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{alumno.numeroControl ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{alumno.origen === 'BASE' ? 'Grupo base' : `Incorporado · grupo base ${alumno.grupo?.nombre ?? 'sin grupo'}`}</td>
                  <td className="px-4 py-3 text-right">
                    {cargandoReportes && !filas.length ? '…' : <Promedio r={r} />}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.asistencia.porcentaje == null ? 'Sin registros' : (
                      <span className="tabular-nums"><span className="text-foreground">{r.asistencia.porcentaje} %</span> · {r.asistencia.faltas} F · {r.asistencia.retardos} R · {r.asistencia.justificadas} J</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.motivos.length ? <span className="text-warning-foreground">{r.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · ')}</span> : <span className="text-muted-foreground">Sin señales</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">F: faltas · R: retardos · J: justificadas. El criterio de riesgo vigente combina faltas y retardos; se muestran por separado.</p>
    </>
  )
}

function MateriasUnidades({ j, ofertas, reportes }) {
  const [params, setParams] = useSearchParams()
  const elegida = ofertas.find((o) => String(o.materia.id) === params.get('materia')) ?? ofertas[0]
  if (!elegida) return <Vacio titulo="Sin materias en el periodo">El grupo no tiene materias asignadas en este periodo.</Vacio>
  const estado = reportes[`${elegida.materia.id}:${elegida.grupo.id}`] ?? { cargando: true }
  const reporte = estado.data
  const unidades = reporte?.unidades ?? []
  const fechas = new Map(elegida.unidades.map((u) => [u.id, u]))
  const alumnos = new Map()
  ;(reporte?.rows ?? []).forEach((row) => {
    if (!alumnos.has(row.alumno.id)) alumnos.set(row.alumno.id, { alumno: row.alumno, celdas: {} })
    alumnos.get(row.alumno.id).celdas[row.unidad?.id ?? row.unidad?.orden] = row
  })
  const cambiar = (materiaId) => { const next = new URLSearchParams(params); next.set('materia', materiaId); setParams(next, { replace: true }) }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <label className="grid min-w-[260px] gap-1.5 text-xs font-medium text-muted-foreground">
          Materia
          <select className={selectClass} value={elegida.materia.id} onChange={(e) => cambiar(e.target.value)}>
            {ofertas.map((o) => <option key={o.id} value={o.materia.id}>{o.materia.nombre}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {elegida.docentes.length ? elegida.docentes.map((d) => d.nombre).join(', ') : 'Sin docente asignado'}
          {' · '}<Link className={linkClass} to={j.to(`/jefe-carrera/materias/${elegida.materia.id}`, { oferta: elegida.grupo.id })}>Consultar la oferta</Link>
        </p>
      </div>

      {estado.error ? <Aviso tono="error" titulo="No se pudo consultar la materia">{estado.error}</Aviso> : !reporte ? (
        <div className="mt-5 h-64 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" />
      ) : (
        <>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Avance de unidades">
            {unidades.map((u) => {
              const info = ESTADO_UNIDAD[u.status] ?? ESTADO_UNIDAD.PENDIENTE
              const fin = fechas.get(u.id)?.fechaFin
              return (
                <li key={u.id ?? u.orden}>
                  <Chip tone={info.tono}>{u.nombre} · {info.label}{u.status === 'FINALIZADA' ? '' : fin ? ` · cierre ${new Date(fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ' · sin plazo definido'}</Chip>
                </li>
              )
            })}
          </ul>
          {alumnos.size ? (
            <div className="mt-4 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card" role="region" aria-label={`Calificaciones de ${elegida.materia.nombre} por unidad`} tabIndex={0}>
              <table className="w-full min-w-[720px] border-collapse text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                    <th scope="col" className="sticky left-0 bg-background px-4 py-2.5 font-medium">Alumno</th>
                    {unidades.map((u) => <th key={u.id ?? u.orden} scope="col" className="px-3 py-2.5 text-right font-medium">{u.nombre}</th>)}
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Promedio</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Observaciones del docente</th>
                  </tr>
                </thead>
                <tbody>
                  {[...alumnos.values()].map(({ alumno, celdas }) => {
                    const filas = Object.values(celdas)
                    const r = resumenAlumno(filas)
                    return (
                      <tr key={alumno.id} className="border-b border-border last:border-b-0">
                        <th scope="row" className="sticky left-0 bg-card px-4 py-3 text-left font-medium text-foreground">{alumno.nombre}</th>
                        {unidades.map((u) => <td key={u.id ?? u.orden} className="px-3 py-3 text-right"><Nota row={celdas[u.id ?? u.orden]} /></td>)}
                        <td className="px-3 py-3 text-right"><Promedio r={r} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.observaciones.length ? r.observaciones.map((o) => <p key={o.unidad}><b className="font-medium text-foreground">{o.unidad}:</b> {o.texto}</p>) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <Vacio titulo="Sin alumnos inscritos">La materia no tiene inscripciones aceptadas en este grupo.</Vacio>}
          <p className="mt-2.5 text-xs text-muted-foreground">Las calificaciones son de consulta. Una celda sin captura no cuenta como cero.</p>
        </>
      )}
    </>
  )
}
