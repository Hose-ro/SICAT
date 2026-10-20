import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CalendarClock, ChevronDown, LoaderCircle, NotebookPen, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import { CRITERIO_RIESGO, ESTADOS_PENDIENTES, MOTIVOS_RIESGO, esIncidencia, estadoClase, senalUnidad } from './supervision/estados'
import { fechaCorta, haceTiempo, hoyClave, modalidadTexto, parseClave, plural } from './supervision/formato'
import { useClases } from './supervision/useClasesSemana'
import { Aviso, JefaturaPage, SeccionTitulo, linkClass } from './supervision/ui'
import { BotonSeguimiento, EstadoSeguimiento } from './supervision/Seguimiento'
import { esParaHoy, useSeguimientos } from './supervision/useSeguimientos'
import TendenciaCobertura from './graficas/TendenciaCobertura'
import './inicio.css'

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

/** Modalidades con grupos en el periodo cuyo calendario escolar no está configurado. */
function calendariosFaltantes(resumen) {
  const modalidades = new Set(resumen.grupos.map((g) => g.modalidad ?? 'ESCOLARIZADO'))
  return resumen.calendarios.filter((c) => !c.configurado && modalidades.has(c.modalidad))
}

function Contenido({ j, resumen }) {
  const [todosDocentes, setTodosDocentes] = useState(false)
  const seguimientos = useSeguimientos({ carreraId: j.carreraId, periodo: j.periodo })
  const grupos = pendientesPorDocente(resumen)
  const { indicadores, intervalo } = resumen
  const unidadesPorRevisar = new Set(resumen.ofertas.flatMap((o) => o.unidades.filter((u) => senalUnidad(u)).map((u) => u.id))).size
  const ofertaIncompleta = resumen.ofertas.filter((o) => !o.docentes.length || !o.horarios.length).length
  const riesgos = [...resumen.riesgos].sort((a, b) => b.causas.length - a.causas.length || a.nombre.localeCompare(b.nombre, 'es'))
  // Sin calendario no hay clases evaluables: cero pendientes no significa listas al día.
  const sinCalendario = calendariosFaltantes(resumen)
  const evaluables = resumen.calendarios.some((c) => c.configurado && !sinCalendario.includes(c))
  const listasVacio = !sinCalendario.length ? 'Listas al día'
    : evaluables ? `Listas al día en ${resumen.calendarios.filter((c) => c.configurado).map((c) => modalidadTexto(c.modalidad)).join(' y ')}`
      : 'Listas no evaluables'

  return (
    <>
      <ResumenCards j={j} indicadores={indicadores} listasVacio={listasVacio} unidadesPorRevisar={unidadesPorRevisar} ofertaIncompleta={ofertaIncompleta} />
      {intervalo && <p className="inicio-periodo">Listas revisadas del {fechaBreve(intervalo.desde)} al {fechaBreve(intervalo.hasta)}</p>}

      {sinCalendario.length > 0 && (
        <Aviso
          titulo={`Pendientes de lista no evaluables en ${sinCalendario.map((c) => modalidadTexto(c.modalidad)).join(' y ')}`}
        >
          Falta configurar el calendario escolar de {sinCalendario.length === 1 ? 'esa modalidad' : 'esas modalidades'} para el periodo. Mientras tanto sus clases no cuentan como pendientes, así que un cero no significa que las listas estén al día. Lo configura coordinación en Calendario escolar.
        </Aviso>
      )}

      <div className="inicio-principal">
        <RequiereAtencion j={j} grupos={grupos} riesgos={riesgos} seguimientos={seguimientos} ofertaIncompleta={ofertaIncompleta} />
        <GuiaPrimerUso />
      </div>

      <TendenciaCobertura j={j} resumen={resumen} />

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
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            {sinCalendario.length && !evaluables
              ? 'Sin pendientes de calificaciones, entregas ni unidades. Las listas no se pueden evaluar hasta configurar el calendario.'
              : 'Sin pendientes de docentes en el periodo: listas, calificaciones, entregas y unidades al corriente.'}
          </p>
        )}
      </section>

      <AlumnosRiesgo j={j} riesgos={riesgos} seguimientos={seguimientos} />

      <HoyEnLaCarrera j={j} />
    </>
  )
}

/** Cuatro áreas del resumen; cada enlace conserva su conjunto de pendientes. */
function ResumenCards({ j, indicadores, listasVacio, unidadesPorRevisar, ofertaIncompleta }) {
  const cards = [
    { titulo: 'Asistencia', icono: CalendarClock, value: indicadores.listasPendientes, label: indicadores.listasPendientes === 1 ? 'Lista por completar' : 'Listas por completar', vacio: listasVacio, href: '#pendientes-docentes', pie: 'Registro de listas en el periodo' },
    { titulo: 'Calificaciones', icono: BookOpen, value: indicadores.calificacionesPendientes, label: indicadores.calificacionesPendientes === 1 ? 'Calificación pendiente' : 'Calificaciones pendientes', vacio: 'Sin calificaciones pendientes', to: j.to('/jefe-carrera/materias', { vista: 'ofertas', pendientes: 1 }), pie: unidadesPorRevisar ? plural(unidadesPorRevisar, 'Unidad por revisar', 'Unidades por revisar') : 'Unidades al corriente', pieHref: '#pendientes-docentes' },
    { titulo: 'Alumnos', icono: UsersRound, value: indicadores.alumnosRiesgo, label: indicadores.alumnosRiesgo === 1 ? 'Alumno en riesgo' : 'Alumnos en riesgo', vacio: 'Sin alumnos en riesgo', href: '#alumnos-riesgo', pie: 'Seguimiento académico' },
    { titulo: 'Asignaciones', icono: BookOpen, value: ofertaIncompleta, label: ofertaIncompleta === 1 ? 'Materia sin docente u horario' : 'Materias sin docente u horario', vacio: 'Oferta completa', to: j.to('/jefe-carrera/materias', { vista: 'ofertas', revision: 'incompleta' }), pie: 'Asignación de docentes y horarios' },
  ]
  return (
    <div className="inicio-resumen" aria-label="Resumen de la carrera">
      {cards.map((card) => {
        const { titulo, icono: Icono, value, label, vacio, to, href, pie, pieHref } = card
        const Destino = href ? 'a' : Link
        return (
          <div key={titulo} className="inicio-card inicio-indicador">
            <p className="inicio-etiqueta">{titulo}</p>
            <Destino {...(href ? { href } : { to })} className="inicio-estado">
              <Icono aria-hidden="true" className="inicio-icono" />
              <span>{value > 0 ? <><b className="font-semibold tabular-nums">{value}</b> {label}</> : vacio}</span>
            </Destino>
            <div className="inicio-pie">{pieHref ? <a href={pieHref} className={linkClass}>{pie}</a> : pie}</div>
          </div>
        )
      })}
    </div>
  )
}

const GUIA_KEY = 'sicat.jefatura.guia'

/** Ayuda opcional de primer uso: tres pasos, se oculta y se recuerda. */
function GuiaPrimerUso() {
  const [visible, setVisible] = useState(() => { try { return localStorage.getItem(GUIA_KEY) !== 'oculta' } catch { return true } })
  if (!visible) {
    return (
      <p className="inicio-card inicio-guia-cerrada text-xs text-muted-foreground">
        <button type="button" className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} onClick={() => { setVisible(true); try { localStorage.removeItem(GUIA_KEY) } catch { /* sin almacenamiento */ } }}>Cómo revisar tu carrera</button>
      </p>
    )
  }
  const ocultar = () => { setVisible(false); try { localStorage.setItem(GUIA_KEY, 'oculta') } catch { /* sin almacenamiento */ } }
  return (
    <section aria-labelledby="guia-jefatura" className="inicio-card inicio-guia">
      <div className="flex items-start justify-between gap-3">
        <h2 id="guia-jefatura" className="text-[1.1875rem] font-semibold tracking-[-0.015em] text-foreground">Cómo revisar tu carrera</h2>
        <Button variant="ghost" size="icon" aria-label="Ocultar la guía" onClick={ocultar}><X aria-hidden="true" /></Button>
      </div>
      <ol className="inicio-pasos">
        <li><span className="inicio-paso-numero" aria-hidden="true">01</span><div><b className="block font-medium text-foreground">Revisa lo que requiere atención</b><span className="text-muted-foreground">Empieza por los casos de abajo: seguimientos para hoy, la lista más antigua sin captura y los alumnos en riesgo.</span></div></li>
        <li><span className="inicio-paso-numero" aria-hidden="true">02</span><div><b className="block font-medium text-foreground">Consulta la evidencia</b><span className="text-muted-foreground">«Ver detalle» y «Ver clase» muestran lo registrado en SICAT. Sin captura no prueba que la clase no se impartiera.</span></div></li>
        <li><span className="inicio-paso-numero" aria-hidden="true">03</span><div><b className="block font-medium text-foreground">Registra el acuerdo</b><span className="text-muted-foreground">«Registrar seguimiento» guarda una nota con tu nombre y fecha. No envía mensajes ni corrige listas; para contactar usa «Preparar correo».</span></div></li>
      </ol>
    </section>
  )
}

/**
 * Los pocos casos con los que conviene empezar: revisiones vencidas, la lista
 * pendiente más antigua y el acceso a los alumnos en riesgo. El orden es
 * operativo (antigüedad y fecha de revisión), no una gravedad.
 */
function RequiereAtencion({ j, grupos, riesgos, seguimientos, ofertaIncompleta }) {
  const paraHoy = seguimientos.lista.filter(esParaHoy)
  const masAntigua = grupos.find((g) => g.desde)
  const items = []
  if (seguimientos.error) {
    items.push({ key: 'seg-error', texto: 'No se pudieron consultar los seguimientos; las revisiones para hoy no se muestran.', tono: 'text-warning-foreground', accion: <Button variant="outline" size="sm" onClick={seguimientos.reintentar}>Reintentar</Button> })
  } else if (paraHoy.length) {
    const vencidos = paraHoy.filter((s) => s.fechaRevision < hoyClave()).length
    items.push({
      key: 'seguimientos',
      texto: `${plural(paraHoy.length, 'seguimiento para revisar hoy', 'seguimientos para revisar hoy')}${vencidos ? `, ${vencidos} con fecha ya pasada` : ''}`,
      accion: <Link className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} to={j.to('/jefe-carrera/seguimientos', { vista: 'hoy' })}>Abrir seguimientos</Link>,
    })
  }
  if (masAntigua) {
    const c = masAntigua.listas[0]
    items.push({
      key: 'lista',
      texto: `Lista más antigua sin captura completa: ${c.materia.nombre}, ${c.grupo.nombre}, ${fechaCorta(c.fecha)} (${haceTiempo(c.fecha).toLowerCase()}) · ${masAntigua.docente?.nombre ?? 'sin docente asignado'}`,
      accion: <Link className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} to={j.to('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined })}>Ver la evidencia</Link>,
    })
  }
  if (riesgos.length) {
    items.push({
      key: 'riesgo',
      texto: `${plural(riesgos.length, 'alumno cumple', 'alumnos cumplen')} el criterio de riesgo`,
      accion: <a className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} href="#alumnos-riesgo">Revisar alumnos en riesgo</a>,
    })
  }

  return (
    <section aria-labelledby="requiere-atencion" className="inicio-card inicio-atencion">
      <SeccionTitulo id="requiere-atencion" titulo="Requiere atención" descripcion="Por dónde empezar hoy. El detalle completo está más abajo." />
      {ofertaIncompleta > 0 && (
        <div className="inicio-asignacion">
          <BookOpen className="inicio-icono" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground"><span className="inicio-cifra">{ofertaIncompleta}</span> {ofertaIncompleta === 1 ? 'Materia sin docente u horario' : 'Materias sin docente u horario'}</p>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">No cuentan con docente asignado o tienen horario sin registrar en el periodo actual.</p>
          </div>
          <Link className={cn(buttonVariants(), 'min-h-11 whitespace-normal')} to={j.to('/jefe-carrera/materias', { vista: 'ofertas', revision: 'incompleta' })}>Revisar materias</Link>
        </div>
      )}
      {items.length ? (
        <ul className="divide-y divide-border border-t border-border text-[0.8125rem]">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className={cn('min-w-0', item.tono ?? 'text-foreground')}>{item.texto}</span>
              <span className="shrink-0">{item.accion}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inicio-sin-pendientes"><NotebookPen className="inicio-icono" aria-hidden="true" /><span>Sin revisiones para hoy, listas atrasadas ni alumnos en riesgo.</span></p>
      )}
    </section>
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
