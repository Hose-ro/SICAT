import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import MapaRiesgoGrupo from './graficas/MapaRiesgoGrupo'
import AlumnoExpediente from './supervision/AlumnoExpediente'
import HorarioCarrera from './supervision/HorarioCarrera'
import { CRITERIO_RIESGO, MOTIVOS_RIESGO } from './supervision/estados'
import { modalidadTexto, plural, semestreTexto } from './supervision/formato'
import { Promedio } from './supervision/notas'
import UnidadesOferta from './supervision/UnidadesOferta'
import { mensajeError } from './supervision/useJefatura'
import { estadoConjunto, reintentarReportes, resumenAlumno, useReportes } from './supervision/useReportes'
import { Aviso, AvisoParcial, JefaturaPage, Pestanas, Vacio, linkClass, selectClass } from './supervision/ui'
import { Senal } from './supervision/senales'
import './supervision/consulta.css'

const TABS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'riesgo', label: 'Riesgo' },
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
      subtitulo={(r) => { const grupo = r.grupos.find((g) => g.id === Number(id)); return grupo && `${semestreTexto(grupo.semestre)} · ${modalidadTexto(grupo.modalidad)} · ${plural(grupo.alumnosBase ?? 0, 'alumno', 'alumnos')}` }}
      volver={{ to: '/jefe-carrera/grupos', label: 'Grupos y alumnos' }}
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
      <Pestanas label="Secciones del grupo" activa={tab} items={TABS.map((t) => ({ ...t, to: tabTo(t.value), count: t.value === 'alumnos' && expediente.data ? alumnos.length : t.value === 'materias' ? ofertas.length : t.value === 'riesgo' ? grupo.alumnosRiesgo : undefined }))} />

      {alumnoId && !alumnoAbierto && (expediente.data || expediente.error) && (
        <Aviso
          tono={expediente.error ? 'error' : 'neutral'}
          titulo={expediente.error ? 'No se pudo abrir el expediente' : 'El alumno no está en este grupo'}
          accion={<Button variant="outline" onClick={cerrarAlumno}>Cerrar aviso</Button>}
        >
          {expediente.error || 'El enlace apunta a un alumno que no pertenece a este grupo en el periodo, o que ya no está inscrito.'}
        </Aviso>
      )}

      {tab === 'resumen' && <Resumen j={j} resumen={resumen} grupo={grupo} ofertas={ofertas} reportes={reportes} expediente={expediente} abrirAlumno={abrirAlumno} mapaTo={tabTo('riesgo')} />}
      {tab === 'riesgo' && <MapaRiesgoGrupo j={j} grupo={grupo} ofertas={ofertas} reportes={reportes} expediente={expediente} abrirAlumno={abrirAlumno} alumnoActivo={alumnoAbierto?.id} />}
      {tab === 'alumnos' && <Alumnos grupo={grupo} ofertas={ofertas} reportes={reportes} expediente={expediente} abrirAlumno={abrirAlumno} />}
      {tab === 'materias' && <MateriasUnidades j={j} ofertas={ofertas} reportes={reportes} />}
      {tab === 'horario' && <HorarioCarrera j={j} resumen={resumen} fijo={{ grupoId }} titulo={`Horario de ${grupo.nombre}`} descripcion="Las mismas vistas del horario general, solo con este grupo." />}

      <AlumnoExpediente j={j} alumno={alumnoAbierto} ofertas={ofertas} enRiesgo={Boolean(alumnoAbierto && resumen.riesgos.some((a) => a.id === alumnoAbierto.id))} cargando={Boolean(alumnoId && expediente.cargando)} onClose={cerrarAlumno} />
    </>
  )
}

function Resumen({ j, resumen, grupo, ofertas, reportes, expediente, abrirAlumno, mapaTo }) {
  const incorporados = (expediente.data?.alumnos ?? []).filter((a) => a.origen === 'INCORPORADO').length
  const listas = resumen.pendientes.filter((c) => c.grupo.id === grupo.id)
  const riesgos = resumen.riesgos.filter((a) => a.causas.some((c) => c.grupo.id === grupo.id))
  const conjunto = estadoConjunto(reportes, ofertas.map((o) => `${o.materia.id}:${grupo.id}`))
  const calificaciones = ofertas.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0)
  const entregas = ofertas.reduce((n, o) => n + o.resumen.entregasPendientes, 0)
  const alDia = !grupo.alumnosRiesgo && !listas.length && !calificaciones && !entregas
  return (
    <div className="consulta">
      {/* Solo lo que requiere atención; lo que está en cero no se muestra. */}
      <p className="consulta-atencion">
        {grupo.alumnosRiesgo > 0 && <Senal tipo="riesgo">{plural(grupo.alumnosRiesgo, 'alumno en riesgo', 'alumnos en riesgo')}</Senal>}
        <Senal tipo="listas" n={listas.length} />
        <Senal tipo="calificaciones" n={calificaciones} />
        <Senal tipo="entregas" n={entregas} />
        {alDia && <span className="text-[0.8125rem] text-muted-foreground">Sin pendientes en el periodo</span>}
        {incorporados > 0 && <span className="consulta-tenue">{plural(incorporados, 'alumno incorporado de otro grupo', 'alumnos incorporados de otros grupos')}</span>}
      </p>

      <section className="consulta-bloque" aria-labelledby="grupo-materias">
        <div className="consulta-bloque-cabeza"><h2 id="grupo-materias">Materias</h2></div>
        <AvisoParcial conjunto={conjunto} total={ofertas.length} onReintentar={reintentarReportes} />
        {ofertas.length ? (
          <ul className="consulta-lista">
            {ofertas.map((o) => {
              const estadoReporte = reportes[`${o.materia.id}:${grupo.id}`]
              const unidades = estadoReporte?.data?.unidades ?? []
              const actual = unidades.findIndex((u) => u.status === 'ACTIVA') + 1
              const listasMateria = listas.filter((c) => c.materia.id === o.materia.id).length
              return (
                <li key={o.id} className="consulta-gmateria">
                  <div className="min-w-0">
                    <Link className="consulta-nombre" to={j.toDesde(`/jefe-carrera/materias/${o.materia.id}`, { oferta: grupo.id })}>{o.materia.nombre}</Link>
                    <p className="consulta-tenue consulta-meta">
                      {o.docentes.length
                        ? o.docentes.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link className="hover:text-primary-ink" to={j.toDesde(`/jefe-carrera/docentes/${d.id}`)}>{d.nombre}</Link></span>)
                        : <span className="consulta-falta">Sin docente asignado</span>}
                      {' · '}{plural(o.resumen.alumnos, 'inscrito', 'inscritos')}
                    </p>
                  </div>
                  <div className="consulta-unidades">
                    {unidades.length ? (
                      <>
                        <span className="consulta-segmentos" aria-hidden="true">{unidades.map((u) => <span key={u.id ?? u.nombre} data-estado={u.status} />)}</span>
                        <span className="consulta-tenue">{actual ? `Unidad ${actual} de ${unidades.length}` : `${unidades.filter((u) => u.status === 'FINALIZADA').length} de ${unidades.length} cerradas`}</span>
                      </>
                    ) : <span className="consulta-tenue">{estadoReporte?.error ? 'Unidades no disponibles' : estadoReporte?.data ? 'Sin unidades' : 'Cargando…'}</span>}
                  </div>
                  <div className="consulta-senales">
                    {o.resumen.alumnosRiesgo > 0 && <Senal tipo="riesgo">{o.resumen.alumnosRiesgo} en riesgo</Senal>}
                    <Senal tipo="listas" n={listasMateria} />
                    <Senal tipo="calificaciones" n={o.resumen.calificacionesPendientes} />
                    <Senal tipo="entregas" n={o.resumen.entregasPendientes} />
                  </div>
                </li>
              )
            })}
          </ul>
        ) : <Vacio titulo="Sin materias en el periodo">El grupo no tiene materias asignadas en este periodo.</Vacio>}
      </section>

      <section className="consulta-bloque" aria-labelledby="grupo-riesgo">
        <div className="consulta-bloque-cabeza">
          <h2 id="grupo-riesgo">Alumnos en riesgo</h2>
          <details className="consulta-criterio">
            <summary><Info aria-hidden="true" />Criterio</summary>
            <p>{CRITERIO_RIESGO}</p>
          </details>
          {riesgos.length > 0 && <Link className={cn(linkClass, 'ml-auto inline-flex min-h-11 items-center text-[0.8125rem]')} to={mapaTo}>Ver mapa por materia</Link>}
        </div>
        {riesgos.length ? (
          <ul className="consulta-lista">
            {riesgos.map((a) => (
              <li key={a.id} className="consulta-riesgo">
                <span className="flex min-w-0 items-center gap-2">
                  {a.sexo && <SexoBadge sexo={a.sexo} />}
                  <button type="button" onClick={() => abrirAlumno(a.id)} className={cn(linkClass, 'text-left text-sm text-foreground')}>{a.nombre}</button>
                </span>
                <span className="consulta-tenue tabular-nums">{a.numeroControl ?? ''}</span>
                <span className="consulta-causas">
                  {a.causas.filter((c) => c.grupo.id === grupo.id).map((c) => (
                    <span key={`${c.materia.id}`} className="consulta-causa">
                      <span className="consulta-tenue">{c.materia.nombre}</span>
                      {c.motivos.map((m) => <span key={m} className="consulta-motivo" data-motivo={m}>{MOTIVOS_RIESGO[m] ?? m}</span>)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 border-t border-border py-5 text-sm text-muted-foreground">Sin alumnos con señales de riesgo en las materias del grupo.</p>}
      </section>
    </div>
  )
}

function Alumnos({ grupo, ofertas, reportes, expediente, abrirAlumno }) {
  if (expediente.cargando && !expediente.data) return <div className="mt-6 h-64 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" />
  if (expediente.error) return <Aviso tono="error" titulo="No se pudo cargar el alumnado">{expediente.error}</Aviso>
  const alumnos = expediente.data.alumnos
  if (!alumnos.length) return <Vacio titulo="Sin alumnos">Ningún alumno pertenece al grupo ni está incorporado a sus materias en este periodo.</Vacio>
  const conjunto = estadoConjunto(reportes, ofertas.map((o) => `${o.materia.id}:${grupo.id}`))
  const filas = alumnos.map((alumno) => {
    const propias = ofertas.flatMap((o) => (reportes[`${o.materia.id}:${grupo.id}`]?.data?.rows ?? []).filter((r) => r.alumno.id === alumno.id))
    // Sin respuesta completa no se afirma nada: «Sin señales» solo con todas las materias consultadas.
    const pendiente = conjunto.cargando ? 'Cargando…' : conjunto.fallidos ? (propias.length ? 'Datos parciales' : 'No disponible') : null
    const enRiesgo = ofertas.filter((o) => (reportes[`${o.materia.id}:${grupo.id}`]?.data?.rows ?? []).some((r) => r.alumno.id === alumno.id && r.motivos?.length)).length
    return { alumno, filas: propias, r: resumenAlumno(propias), pendiente, enRiesgo }
  })

  return (
    <>
      <AvisoParcial conjunto={conjunto} total={ofertas.length} onReintentar={reintentarReportes} />
      {/* En móvil, una tarjeta por alumno: señal y acción sin recorrer una tabla ancha. */}
      <ul className="mt-4 divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card md:hidden" aria-label="Alumnos del grupo">
        {filas.map(({ alumno, filas: propias, r, pendiente, enRiesgo }) => (
          <li key={alumno.id} className="px-4 py-3 text-[0.8125rem]">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => abrirAlumno(alumno.id)} className={cn(linkClass, 'min-w-0 text-left text-[0.9375rem] text-foreground')}>{alumno.nombre}</button>
              <SexoBadge sexo={alumno.sexo} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{alumno.numeroControl ?? 'Sin número de control'}{alumno.origen !== 'BASE' && ` · Incorporado de ${alumno.grupo?.nombre ?? 'sin grupo'}`}</p>
            <p className="mt-1">
              {r.motivos.length
                ? <span className="text-destructive-foreground" title={r.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · ')}>{plural(enRiesgo, 'materia', 'materias')}</span>
                : pendiente ? <EstadoDato texto={pendiente} /> : <span className="text-muted-foreground">—</span>}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {!propias.length && pendiente ? null : <>Promedio {r.promedio ?? 'sin captura'}{r.promedio != null && ` (${r.tipo === 'REAL' ? 'definitivo' : 'provisional'})`} · </>}
              Asistencia {r.asistencia.porcentaje == null ? (pendiente ? pendiente.toLowerCase() : 'sin registros') : `${r.asistencia.porcentaje} %`}
            </p>
          </li>
        ))}
      </ul>
      <div role="region" tabIndex={0} aria-label="Alumnos del grupo" className="mt-4 overflow-x-auto rounded-[var(--radius-item)] max-md:hidden border border-border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
        <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Alumno</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Control</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Promedio</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Asistencia</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ alumno, filas, r, pendiente, enRiesgo }) => {
              return (
                <tr key={alumno.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <button type="button" onClick={() => abrirAlumno(alumno.id)} className={cn(linkClass, 'min-h-8 text-left text-foreground')}>{alumno.nombre}</button>
                      <SexoBadge sexo={alumno.sexo} />
                    </span>
                    {alumno.origen !== 'BASE' && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Incorporado · {alumno.grupo?.nombre ?? 'sin grupo'}</span>}
                  </th>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{alumno.numeroControl ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {!filas.length && pendiente ? <EstadoDato texto={pendiente} /> : <Promedio r={r} compacto />}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.asistencia.porcentaje == null ? (pendiente ? <EstadoDato texto={pendiente} /> : 'Sin registros') : (
                      <span className="tabular-nums text-foreground" title={`${r.asistencia.faltas} faltas · ${r.asistencia.retardos} retardos · ${r.asistencia.justificadas} justificadas`}>{r.asistencia.porcentaje} %</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.motivos.length
                      ? <span className="text-destructive-foreground" title={r.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · ')}>{plural(enRiesgo, 'materia', 'materias')}{pendiente === 'Datos parciales' && <span className="block text-xs text-muted-foreground">Datos parciales</span>}</span>
                      : pendiente ? <EstadoDato texto={pendiente} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Celda sin dato confiable: cargando, no disponible o parcial; nunca un cero ni «sin señales». */
function EstadoDato({ texto }) {
  return <span className={cn('text-xs', texto === 'Cargando…' ? 'text-muted-foreground' : 'font-medium text-warning-foreground')}>{texto}</span>
}

function MateriasUnidades({ ofertas, reportes }) {
  const [params, setParams] = useSearchParams()
  const elegida = ofertas.find((o) => String(o.materia.id) === params.get('materia')) ?? ofertas[0]
  if (!elegida) return <Vacio titulo="Sin materias en el periodo">El grupo no tiene materias asignadas en este periodo.</Vacio>
  const cambiar = (materiaId) => { const next = new URLSearchParams(params); next.set('materia', materiaId); setParams(next, { replace: true }) }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <label className="grid w-full gap-1.5 text-xs font-medium text-muted-foreground sm:w-auto sm:min-w-[260px]">
          <span className="sr-only">Materia</span>
          <select className={selectClass} value={elegida.materia.id} onChange={(e) => cambiar(e.target.value)}>
            {ofertas.map((o) => <option key={o.id} value={o.materia.id}>{o.materia.nombre}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {elegida.docentes.length ? elegida.docentes.map((d) => d.nombre).join(', ') : 'Sin docente asignado'}
        </p>
      </div>
      <UnidadesOferta compacto oferta={elegida} estado={reportes[`${elegida.materia.id}:${elegida.grupo.id}`]} />
    </>
  )
}
