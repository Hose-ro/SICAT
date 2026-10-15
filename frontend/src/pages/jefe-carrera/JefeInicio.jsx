import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import { CRITERIO_RIESGO, ESTADOS_PENDIENTES, MOTIVOS_RIESGO, esIncidencia, estadoClase, senalUnidad } from './supervision/estados'
import { fechaCorta, haceTiempo, hoyClave, parseClave, plural } from './supervision/formato'
import { useClases } from './supervision/useClasesSemana'
import { JefaturaPage, SeccionTitulo, Senales, linkClass } from './supervision/ui'
import { BotonSeguimiento, EstadoSeguimiento } from './supervision/Seguimiento'
import { useSeguimientos } from './supervision/useSeguimientos'

const DOCENTES_VISIBLES = 8
const ALUMNOS_VISIBLES = 8
const PROXIMAS_VISIBLES = 3

function fechaBreve(clave) {
  return parseClave(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/**
 * Pendientes agrupados por docente: listas sin captura, calificaciones,
 * entregas por revisar y unidades sin cerrar. Primero quien tiene la lista
 * pendiente más antigua; las ofertas sin docente quedan en su propio grupo.
 */
function pendientesPorDocente(resumen) {
  const grupos = new Map()
  const grupo = (docente) => {
    const key = docente?.id ?? 'sin-docente'
    if (!grupos.has(key)) grupos.set(key, { key, docente: docente ?? null, listas: [], calificaciones: [], entregas: [], unidades: [] })
    return grupos.get(key)
  }
  const responsables = (o) => (o.docentes.length ? o.docentes : [null])

  resumen.pendientes.forEach((c) => grupo(c.docente).listas.push(c))
  resumen.ofertas.forEach((o) => {
    if (o.resumen.calificacionesPendientes > 0) responsables(o).forEach((d) => grupo(d).calificaciones.push(o))
    if (o.resumen.entregasPendientes > 0) responsables(o).forEach((d) => grupo(d).entregas.push(o))
    o.unidades.forEach((u) => {
      const senal = senalUnidad(u)
      if (!senal) return
      responsables(o).forEach((d) => {
        const g = grupo(d)
        if (!g.unidades.some((x) => x.unidad.id === u.id)) g.unidades.push({ unidad: u, materia: o.materia, senal })
      })
    })
  })

  return [...grupos.values()]
    .map((g) => {
      g.listas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
      return {
        ...g,
        desde: g.listas[0]?.fecha ?? null,
        calificacionesTotal: g.calificaciones.reduce((n, o) => n + o.resumen.calificacionesPendientes, 0),
        entregasTotal: g.entregas.reduce((n, o) => n + o.resumen.entregasPendientes, 0),
      }
    })
    .sort((a, b) => {
      if (a.desde && b.desde && a.desde !== b.desde) return a.desde.localeCompare(b.desde)
      if (a.desde !== b.desde) return a.desde ? -1 : 1
      return (b.listas.length + b.calificacionesTotal) - (a.listas.length + a.calificacionesTotal)
    })
}

function resumenGrupo(g) {
  return [
    g.listas.length && plural(g.listas.length, 'lista sin captura completa', 'listas sin captura completa'),
    g.calificacionesTotal && plural(g.calificacionesTotal, 'calificación de unidad pendiente', 'calificaciones de unidad pendientes'),
    g.entregasTotal && plural(g.entregasTotal, 'entrega sin revisar', 'entregas sin revisar'),
    g.unidades.length && plural(g.unidades.length, 'unidad por revisar', 'unidades por revisar'),
  ].filter(Boolean)
}

export default function JefeInicio() {
  return (
    <JefaturaPage titulo="Inicio" subtitulo="Resumen de tu carrera: lo que pasa hoy y lo que requiere atención.">
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen }) {
  const [todosDocentes, setTodosDocentes] = useState(false)
  const seguimientos = useSeguimientos({ carreraId: j.carreraId, periodo: j.periodo })
  const grupos = pendientesPorDocente(resumen)
  const { indicadores, intervalo } = resumen
  const unidadesPorRevisar = new Set(resumen.ofertas.flatMap((o) => o.unidades.filter((u) => senalUnidad(u)).map((u) => u.id))).size
  const ofertaIncompleta = resumen.ofertas.filter((o) => !o.docentes.length || !o.horarios.length).length
  const riesgos = [...resumen.riesgos].sort((a, b) => b.causas.length - a.causas.length || a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <>
      <Senales
        items={[
          { label: indicadores.listasPendientes === 1 ? 'Lista por completar' : 'Listas por completar', value: indicadores.listasPendientes, vacio: 'Listas al día', href: '#pendientes-docentes' },
          { label: indicadores.calificacionesPendientes === 1 ? 'Calificación pendiente' : 'Calificaciones pendientes', value: indicadores.calificacionesPendientes, vacio: 'Sin calificaciones pendientes', to: j.to('/jefe-carrera/materias', { pendientes: 1 }) },
          { label: unidadesPorRevisar === 1 ? 'Unidad por revisar' : 'Unidades por revisar', value: unidadesPorRevisar, vacio: 'Unidades al corriente', href: '#pendientes-docentes' },
          { label: indicadores.alumnosRiesgo === 1 ? 'Alumno en riesgo' : 'Alumnos en riesgo', value: indicadores.alumnosRiesgo, vacio: 'Sin alumnos en riesgo', href: '#alumnos-riesgo' },
          { label: ofertaIncompleta === 1 ? 'Materia sin docente u horario' : 'Materias sin docente u horario', value: ofertaIncompleta, vacio: 'Oferta completa', to: j.to('/jefe-carrera/materias', { revision: 'incompleta' }) },
        ]}
        nota={intervalo ? `Listas revisadas del ${fechaBreve(intervalo.desde)} al ${fechaBreve(intervalo.hasta)}` : null}
      />

      <HoyEnLaCarrera j={j} />

      <section aria-labelledby="pendientes-docentes" className="mt-10 scroll-mt-6">
        <SeccionTitulo
          id="pendientes-docentes"
          titulo="Pendientes por docente"
          descripcion="Primero quien tiene la lista pendiente más antigua. Registra aquí lo que acuerdes con cada docente."
        />
        {grupos.length ? (
          <>
            <ul className="divide-y divide-border border-y border-border">
              {(todosDocentes ? grupos : grupos.slice(0, DOCENTES_VISIBLES)).map((g) => <GrupoDocente key={g.key} g={g} j={j} seguimientos={seguimientos} />)}
            </ul>
            {grupos.length > DOCENTES_VISIBLES && (
              <Button variant="ghost" className="mt-2 min-h-11" onClick={() => setTodosDocentes((v) => !v)}>
                {todosDocentes ? 'Mostrar menos' : `Ver los ${grupos.length} docentes con pendientes`}
              </Button>
            )}
          </>
        ) : (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">Sin pendientes de docentes en el periodo: listas, calificaciones, entregas y unidades al corriente.</p>
        )}
      </section>

      <AlumnosRiesgo j={j} riesgos={riesgos} seguimientos={seguimientos} />
    </>
  )
}

/**
 * Resumen del día: cuántas clases hay, cuántas ya tienen registro y cuáles
 * siguen. El horario completo vive en Horarios.
 */
function HoyEnLaCarrera({ j }) {
  const hoy = hoyClave()
  const { clases, error, cargando, reintentar } = useClases({ carreraId: j.carreraId, periodo: j.historico ? null : j.periodo, desde: hoy, hasta: hoy })
  const verHorario = <Link className={`${linkClass} inline-flex min-h-11 items-center text-[0.8125rem]`} to={j.to('/jefe-carrera/horarios')}>Ver horario completo</Link>

  if (j.historico) return null

  const delDia = (clases ?? []).filter((c) => c.fecha === hoy)
  const activas = delDia.filter((c) => c.estado !== 'SUSPENDIDA')
  const conRegistro = activas.filter((c) => ['LISTA_COMPLETA', 'REGISTRO_TARDIO', 'REGISTRO_EN_CURSO'].includes(c.estado)).length
  const sinRegistro = activas.filter((c) => c.elegible && ESTADOS_PENDIENTES.has(c.estado)).length
  const incidencias = activas.filter(esIncidencia).length
  const suspendidas = delDia.length - activas.length
  const proximas = activas
    .filter((c) => c.estado === 'PROGRAMADA')
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .slice(0, PROXIMAS_VISIBLES)

  return (
    <section aria-labelledby="hoy-carrera" className="mt-10">
      <SeccionTitulo id="hoy-carrera" titulo="Hoy en la carrera" descripcion="Clases de hoy y su registro. Para comparar grupos o ver otro día, abre el horario." accion={verHorario} />
      {error ? (
        <p role="alert" className="flex flex-wrap items-center gap-3 border-y border-border py-4 text-[0.8125rem] text-warning-foreground">
          {error}
          <Button variant="outline" size="sm" onClick={reintentar}>Reintentar</Button>
        </p>
      ) : cargando || clases === null ? (
        <p className="flex items-center gap-2 border-y border-border py-4 text-[0.8125rem] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Consultando las clases de hoy…</p>
      ) : !activas.length ? (
        <p className="border-y border-border py-4 text-[0.8125rem] text-muted-foreground">
          {suspendidas ? `Hoy no hay clases: ${plural(suspendidas, 'clase suspendida', 'clases suspendidas')}.` : 'Hoy no hay clases programadas en la carrera.'}
        </p>
      ) : (
        <div className="grid gap-6 border-y border-border py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.8125rem] sm:grid-cols-4 md:grid-cols-2">
            {[
              ['Clases hoy', activas.length],
              ['Con registro', conRegistro],
              ['Sin registro', sinRegistro, sinRegistro > 0],
              ['Con incidencia', incidencias, incidencias > 0],
            ].map(([label, value, alerta]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={cn('mt-0.5 text-[1.0625rem] font-semibold tabular-nums', alerta ? 'text-warning-foreground' : 'text-foreground')}>{value}</dd>
              </div>
            ))}
            {suspendidas > 0 && <p className="col-span-full text-xs text-muted-foreground">{plural(suspendidas, 'clase suspendida', 'clases suspendidas')} hoy.</p>}
          </dl>
          <div className="min-w-0">
            <h3 className="text-xs font-medium text-muted-foreground">Siguen hoy</h3>
            {proximas.length ? (
              <ul className="mt-1.5 divide-y divide-border text-[0.8125rem]">
                {proximas.map((c) => (
                  <li key={c.id} className="flex items-baseline gap-3 py-2">
                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{c.horaInicio}–{c.horaFin}</span>
                    <Link className={cn(linkClass, 'min-w-0 truncate text-foreground')} to={j.to('/jefe-carrera/horarios', { fecha: hoy, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined })}>
                      {c.materia.nombre}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.grupo.nombre}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">Ya no quedan clases por empezar hoy.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/** Cerrada por defecto: se abre con el botón o al llegar desde la señal de Inicio. */
function AlumnosRiesgo({ j, riesgos, seguimientos }) {
  const [abierto, setAbierto] = useState(() => window.location.hash === '#alumnos-riesgo')
  useEffect(() => {
    const abrirSiToca = () => { if (window.location.hash === '#alumnos-riesgo') setAbierto(true) }
    window.addEventListener('hashchange', abrirSiToca)
    return () => window.removeEventListener('hashchange', abrirSiToca)
  }, [])

  return (
    <section aria-labelledby="alumnos-riesgo" className="mt-10 scroll-mt-6">
      <SeccionTitulo
        id="alumnos-riesgo"
        titulo="Alumnos en riesgo"
        descripcion={CRITERIO_RIESGO}
        accion={riesgos.length > 0 && (
          <Button variant="outline" aria-expanded={abierto} aria-controls="lista-riesgo" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar lista' : `Ver ${plural(riesgos.length, 'alumno', 'alumnos')}`}
            <ChevronDown aria-hidden="true" className={cn('transition-transform duration-150 ease-out', abierto && 'rotate-180')} />
          </Button>
        )}
      />
      {!riesgos.length ? (
        <p className="border-y border-border py-6 text-sm text-muted-foreground">Ningún alumno cumple el criterio de riesgo en el periodo.</p>
      ) : !abierto ? (
        <p className="border-y border-border py-4 text-[0.8125rem] text-muted-foreground">
          {plural(riesgos.length, 'alumno cumple', 'alumnos cumplen')} el criterio de riesgo. La lista está oculta para que Inicio quede como resumen.
        </p>
      ) : (
        <div id="lista-riesgo">
          <ul className="divide-y divide-border border-y border-border">
            {riesgos.slice(0, ALUMNOS_VISIBLES).map((alumno) => {
              const causa = alumno.causas[0]
              const motivos = [...new Set(alumno.causas.flatMap((c) => c.motivos))].map((m) => MOTIVOS_RIESGO[m] ?? m)
              const materias = [...new Set(alumno.causas.map((c) => c.materia.nombre))]
              return (
                <li key={alumno.id} className="flex flex-col gap-1 py-3 text-[0.8125rem] sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="flex min-w-0 gap-2.5">
                    <span className="inline-flex w-5 shrink-0 pt-px"><SexoBadge sexo={alumno.sexo} /></span>
                    <div className="min-w-0">
                      <Link className={cn(linkClass, 'text-foreground')} to={j.to(`/jefe-carrera/grupos/${causa.grupo.id}`, { tab: 'alumnos', alumno: alumno.id })}>{alumno.nombre}</Link>
                      <span className="ml-2 text-xs text-muted-foreground">Grupo {causa.grupo.nombre}</span>
                      <p className="mt-0.5 text-xs text-muted-foreground">{materias.join(', ')} · {motivos.join(' · ')}</p>
                    </div>
                  </div>
                  <EstadoSeguimiento seguimiento={seguimientos.buscar({ tipo: 'ALUMNO_RIESGO', alumnoId: alumno.id })} className="shrink-0 pl-7 sm:pl-0" />
                </li>
              )
            })}
          </ul>
          {riesgos.length > ALUMNOS_VISIBLES && (
            <Link className={`${linkClass} mt-2 inline-flex min-h-11 items-center text-[0.8125rem]`} to={j.to('/jefe-carrera/grupos', { riesgo: 1 })}>Ver los {riesgos.length} por grupo</Link>
          )}
        </div>
      )}
    </section>
  )
}

function GrupoDocente({ g, j, seguimientos }) {
  const [abierto, setAbierto] = useState(false)
  const detalleId = `detalle-${g.key}`
  const nombre = g.docente?.nombre ?? 'Sin docente asignado'
  return (
    <li className="py-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-start md:gap-6">
        <div className="min-w-0">
          {g.docente
            ? <Link className={cn(linkClass, 'text-[0.9375rem] text-foreground')} to={j.to(`/jefe-carrera/docentes/${g.docente.id}`)}>{nombre}</Link>
            : <span className="text-[0.9375rem] font-medium text-warning-foreground">{nombre}</span>}
          <p className="mt-0.5 text-[0.8125rem] text-foreground">{resumenGrupo(g).join(' · ')}</p>
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          {g.desde ? <>Desde el {fechaCorta(g.desde)}<span className="block text-xs">{haceTiempo(g.desde)}</span></> : <span className="text-xs">Sin listas pendientes</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {g.docente && (
            <BotonSeguimiento
              j={j}
              caso={{ tipo: 'SEGUIMIENTO_DOCENTE', docenteId: g.docente.id }}
              titulo={`Seguimiento con ${nombre}`}
              contexto={resumenGrupo(g).join(' · ')}
            />
          )}
          <Button variant="ghost" size="sm" aria-expanded={abierto} aria-controls={detalleId} onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar detalle' : 'Ver detalle'}
            <ChevronDown aria-hidden="true" className={cn('transition-transform duration-150 ease-out', abierto && 'rotate-180')} />
          </Button>
        </div>
      </div>
      {abierto && (
        <ul id={detalleId} className="mt-3 divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card text-[0.8125rem]">
          {g.listas.map((c) => (
            <Detalle
              key={c.id}
              texto={`${fechaCorta(c.fecha)}, ${c.horaInicio} · ${c.materia.nombre} · ${c.grupo.nombre}`}
              estado={<span className={estadoClase(c.estado).texto}>{c.estado === 'CAPTURA_PARCIAL' ? `Captura parcial (${c.registros} de ${c.alumnos})` : 'Sin captura'}</span>}
              seguimiento={seguimientos.buscar({ tipo: 'ASISTENCIA_SIN_CAPTURA', horarioId: c.horarioId, fecha: c.fecha })}
              enlace={{ label: 'Ver clase', to: j.to('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined }) }}
            />
          ))}
          {g.calificaciones.map((o) => (
            <Detalle
              key={`c-${o.id}`}
              texto={`${o.materia.nombre} · ${o.grupo.nombre}`}
              estado={plural(o.resumen.calificacionesPendientes, 'calificación de unidad cerrada sin capturar', 'calificaciones de unidades cerradas sin capturar')}
              seguimiento={seguimientos.buscar({ tipo: 'CALIFICACIONES_PENDIENTES', materiaId: o.materia.id, grupoId: o.grupo.id })}
              enlace={{ label: 'Ver materia en el grupo', to: j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id }) }}
            />
          ))}
          {g.entregas.map((o) => (
            <Detalle
              key={`e-${o.id}`}
              texto={`${o.materia.nombre} · ${o.grupo.nombre}`}
              estado={plural(o.resumen.entregasPendientes, 'entrega recibida sin revisar', 'entregas recibidas sin revisar')}
              enlace={{ label: 'Ver materia en el grupo', to: j.to(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id }) }}
            />
          ))}
          {g.unidades.map(({ unidad, materia, senal }) => (
            <Detalle
              key={`u-${unidad.id}`}
              texto={`${unidad.nombre} · ${materia.nombre}`}
              estado={<span className="text-warning-foreground">{senal}</span>}
              enlace={{ label: 'Ver materia', to: j.to(`/jefe-carrera/materias/${materia.id}`) }}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function Detalle({ texto, estado, seguimiento, enlace }) {
  return (
    <li className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="text-foreground">{texto}</span>
        <span className="block text-xs text-muted-foreground">{estado}</span>
        <EstadoSeguimiento seguimiento={seguimiento} className="block" />
      </span>
      <Link className={`${linkClass} inline-flex min-h-11 shrink-0 items-center text-xs sm:min-h-0`} to={enlace.to}>{enlace.label}</Link>
    </li>
  )
}
