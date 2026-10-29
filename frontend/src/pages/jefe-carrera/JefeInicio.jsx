import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CalendarClock, ChevronDown, Clock3, NotebookPen, Phone, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import SexoBadge from '@/components/SexoBadge'
import { cn } from '@/lib/utils'
import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import { CRITERIO_RIESGO, MOTIVOS_RIESGO, estadoClase, senalUnidad } from './supervision/estados'
import { fechaCorta, haceTiempo, hoyClave, modalidadTexto, parseClave, plural } from './supervision/formato'
import { Aviso, JefaturaPage, SeccionTitulo, linkClass } from './supervision/ui'
import { BotonSeguimiento, EstadoSeguimiento } from './supervision/Seguimiento'
import { esParaHoy, useSeguimientos } from './supervision/useSeguimientos'
import { calendariosFaltantes } from './supervision/pendientes'
import TendenciaCobertura from './graficas/TendenciaCobertura'
import BienvenidaJefatura from './components/BienvenidaJefatura'
import PrimerosPasosJefatura from './components/PrimerosPasosJefatura'
import HoyEnLaCarrera from './components/HoyEnLaCarrera'
import ContactoDocente from './components/ContactoDocente'
import './inicio.css'

const DOCENTES_VISIBLES = 3
const ALUMNOS_VISIBLES = 4

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
    <JefaturaPage titulo="Inicio" subtitulo="Clases de hoy, alumnos en riesgo y pendientes de tus docentes.">
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

/** Reuniones de la carrera, sólo para saber si ya hubo alguna (paso 4 de la guía). */
function useReuniones(carreraId) {
  const [estado, setEstado] = useState({ carreraId: null, lista: null })
  useEffect(() => {
    let vivo = true
    api.get('/jefe-carrera/reuniones', { params: { carreraId } })
      .then(({ data }) => { if (vivo) setEstado({ carreraId, lista: Array.isArray(data) ? data : [] }) })
      .catch(() => { if (vivo) setEstado({ carreraId, lista: [] }) })
    return () => { vivo = false }
  }, [carreraId])
  return estado.carreraId === carreraId ? estado.lista : null
}

const claveBienvenida = (userId) => `sicat.jefatura.bienvenida.${userId}`

function Contenido({ j, resumen }) {
  const userId = useAuthStore((state) => state.user?.id)
  const reuniones = useReuniones(j.carreraId)
  // La bienvenida sale una vez y sólo a quien todavía no tiene retícula u
  // oferta en el periodo: al jefe con la carrera en marcha no le hace falta.
  const [bienvenida, setBienvenida] = useState(() => {
    let vista = false
    try { vista = localStorage.getItem(claveBienvenida(userId)) === 'vista' } catch { /* sin almacenamiento */ }
    return !vista && (resumen.reticula.length === 0 || resumen.ofertas.length === 0)
  })
  const cerrarBienvenida = () => {
    setBienvenida(false)
    try { localStorage.setItem(claveBienvenida(userId), 'vista') } catch { /* sin almacenamiento */ }
    requestAnimationFrame(() => document.getElementById('primeros-pasos')?.focus())
  }
  // Sin grupos ni oferta todo lo demás de Inicio saldría en cero y parecería
  // "al día": sólo se muestra por dónde empezar.
  const vacia = resumen.ofertas.length === 0 && resumen.grupos.length === 0
  const guia = reuniones && (
    <PrimerosPasosJefatura
      key={j.carreraId}
      j={j}
      resumen={resumen}
      reuniones={reuniones}
      userId={userId}
      principal={vacia}
      onComoFunciona={() => setBienvenida(true)}
    />
  )
  const ventana = <BienvenidaJefatura open={bienvenida} onClose={cerrarBienvenida} />

  if (vacia) {
    return (
      <>
        <div className="mt-6 max-w-3xl">{guia}</div>
        {ventana}
      </>
    )
  }

  return <ContenidoCarrera j={j} resumen={resumen} guia={guia} ventana={ventana} />
}

function ContenidoCarrera({ j, resumen, guia, ventana }) {
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
      {ventana}
      {sinCalendario.length > 0 && (
        <Aviso
          titulo={`Pendientes de lista no evaluables en ${sinCalendario.map((c) => modalidadTexto(c.modalidad)).join(' y ')}`}
        >
          Falta configurar el calendario escolar de {sinCalendario.length === 1 ? 'esa modalidad' : 'esas modalidades'} para el periodo. Mientras tanto sus clases no cuentan como pendientes, así que un cero no significa que las listas estén al día. Lo configura coordinación en Calendario escolar.
        </Aviso>
      )}

      <HoyEnLaCarrera j={j} />
      <AlumnosRiesgo j={j} riesgos={riesgos} seguimientos={seguimientos} />

      <section aria-labelledby="pendientes-docentes" className="mt-10 scroll-mt-6">
        <SeccionTitulo
          id="pendientes-docentes"
          titulo="Pendientes por docente"
          descripcion="Revisa los pendientes y registra lo que acuerdes con cada docente."
          accion={grupos.length > 0 && <Link className={cn(linkClass, 'inline-flex min-h-11 items-center text-[0.8125rem]')} to={j.toDesde('/jefe-carrera/seguimientos', { seccion: 'pendientes' })}>Abrir todos en Pendientes y seguimiento</Link>}
        />
        {grupos.length ? (
          <>
            <p className="docentes-orden">Primero, el pendiente más antiguo</p>
            <ul id="docentes-pendientes-lista" className="docentes-fichas">
              {(todosDocentes ? grupos : grupos.slice(0, DOCENTES_VISIBLES)).map((g) => <GrupoDocente key={g.key} g={g} j={j} seguimientos={seguimientos} />)}
            </ul>
            {grupos.length > DOCENTES_VISIBLES && (
              <Button variant="secondary" className="docentes-expandir" aria-expanded={todosDocentes} aria-controls="docentes-pendientes-lista" onClick={() => setTodosDocentes((v) => !v)}>
                {todosDocentes ? 'Mostrar solo los primeros 3 docentes' : `Ver los ${grupos.length} docentes con pendientes`}
                <ChevronDown aria-hidden="true" className={cn('docentes-flecha', todosDocentes && 'docentes-flecha-abierta')} />
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

      <TendenciaCobertura key={`${j.carreraId}:${j.periodo}`} j={j} resumen={resumen} />

      <details className="inicio-secundario mt-10">
        <summary className="inicio-desplegable">Resumen del periodo y otras revisiones</summary>
        <ResumenCards j={j} indicadores={indicadores} listasVacio={listasVacio} unidadesPorRevisar={unidadesPorRevisar} ofertaIncompleta={ofertaIncompleta} />
        {intervalo && <p className="inicio-periodo">Listas revisadas del {fechaBreve(intervalo.desde)} al {fechaBreve(intervalo.hasta)}</p>}
        <div className="inicio-principal">
          <RequiereAtencion j={j} grupos={grupos} riesgos={riesgos} seguimientos={seguimientos} ofertaIncompleta={ofertaIncompleta} />
        </div>
      </details>
      {guia && <div className="mt-8">{guia}</div>}
    </>
  )
}

/**
 * Cuatro áreas del resumen. Todas se comportan igual: abren su conjunto en
 * Pendientes y seguimiento, con el filtro visible y «Volver a Inicio».
 */
function ResumenCards({ j, indicadores, listasVacio, unidadesPorRevisar, ofertaIncompleta }) {
  const conjunto = (tipo) => j.toDesde('/jefe-carrera/seguimientos', { seccion: 'pendientes', tipo })
  const cards = [
    { titulo: 'Asistencia', icono: CalendarClock, value: indicadores.listasPendientes, label: indicadores.listasPendientes === 1 ? 'Lista por completar' : 'Listas por completar', vacio: listasVacio, to: conjunto('ASISTENCIA_SIN_CAPTURA'), pie: 'Registro de listas en el periodo' },
    { titulo: 'Calificaciones', icono: BookOpen, value: indicadores.calificacionesPendientes, label: indicadores.calificacionesPendientes === 1 ? 'Calificación pendiente' : 'Calificaciones pendientes', vacio: 'Sin calificaciones pendientes', to: conjunto('CALIFICACIONES_PENDIENTES'), pie: unidadesPorRevisar ? plural(unidadesPorRevisar, 'Unidad por revisar', 'Unidades por revisar') : 'Unidades al corriente', pieTo: unidadesPorRevisar ? conjunto('UNIDAD') : null },
    { titulo: 'Alumnos', icono: UsersRound, value: indicadores.alumnosRiesgo, label: indicadores.alumnosRiesgo === 1 ? 'Alumno en riesgo' : 'Alumnos en riesgo', vacio: 'Sin alumnos en riesgo', to: conjunto('ALUMNO_RIESGO'), pie: 'Situación académica' },
    { titulo: 'Asignaciones', icono: BookOpen, value: ofertaIncompleta, label: ofertaIncompleta === 1 ? 'Materia sin docente u horario' : 'Materias sin docente u horario', vacio: 'Oferta completa', to: conjunto('ASIGNACION'), pie: 'Asignación de docentes y horarios' },
  ]
  return (
    <div className="inicio-resumen" aria-label="Resumen de la carrera">
      {cards.map((card) => {
        const { titulo, icono: Icono, value, label, vacio, to, pie, pieTo } = card
        return (
          <div key={titulo} className="inicio-card inicio-indicador">
            <p className="inicio-etiqueta">{titulo}</p>
            <Link to={to} className="inicio-estado">
              <Icono aria-hidden="true" className="inicio-icono" />
              <span>{value > 0 ? <><b className="font-semibold tabular-nums">{value}</b> {label}</> : vacio}</span>
            </Link>
            <div className="inicio-pie">{pieTo ? <Link to={pieTo} className={linkClass}>{pie}</Link> : pie}</div>
          </div>
        )
      })}
    </div>
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
    items.push({ key: 'seg-error', texto: 'No se pudieron consultar las observaciones; las revisiones para hoy no se muestran.', tono: 'text-warning-foreground', accion: <Button variant="outline" size="sm" onClick={seguimientos.reintentar}>Reintentar</Button> })
  } else if (paraHoy.length) {
    const vencidos = paraHoy.filter((s) => s.fechaRevision < hoyClave()).length
    items.push({
      key: 'seguimientos',
      texto: `${plural(paraHoy.length, 'observación para revisar hoy', 'observaciones para revisar hoy')}${vencidos ? `, ${vencidos} con fecha ya pasada` : ''}`,
      accion: <Link className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} to={j.toDesde('/jefe-carrera/seguimientos', { seccion: 'observaciones', vista: 'hoy' })}>Abrir observaciones</Link>,
    })
  }
  if (masAntigua) {
    const c = masAntigua.listas[0]
    items.push({
      key: 'lista',
      texto: `Lista más antigua sin captura completa: ${c.materia.nombre}, ${c.grupo.nombre}, ${fechaCorta(c.fecha)} (${haceTiempo(c.fecha).toLowerCase()}) · ${masAntigua.docente?.nombre ?? 'sin docente asignado'}`,
      accion: <Link className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} to={j.toDesde('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined })}>Ver la evidencia</Link>,
    })
  }
  if (riesgos.length) {
    items.push({
      key: 'riesgo',
      texto: `${plural(riesgos.length, 'alumno cumple', 'alumnos cumplen')} el criterio de riesgo`,
      accion: <Link className={cn(linkClass, 'inline-flex min-h-11 items-center md:min-h-0')} to={j.toDesde('/jefe-carrera/seguimientos', { seccion: 'pendientes', tipo: 'ALUMNO_RIESGO' })}>Revisar alumnos en riesgo</Link>,
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
          <Link className={cn(buttonVariants(), 'min-h-11 whitespace-normal')} to={j.toDesde('/jefe-carrera/seguimientos', { seccion: 'pendientes', tipo: 'ASIGNACION' })}>Revisar asignaciones</Link>
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
/** Los primeros casos quedan visibles; la lista completa se consulta por grupo. */
function AlumnosRiesgo({ j, riesgos, seguimientos }) {
  const [abierto, setAbierto] = useState(true)
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
        descripcion={riesgos.length ? `${plural(riesgos.length, 'alumno requiere', 'alumnos requieren')} revisión en el periodo.` : 'Situación académica de los alumnos en el periodo.'}
        accion={riesgos.length > 0 && (
          <Button variant="outline" aria-expanded={abierto} aria-controls="lista-riesgo" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar alumnos' : `Ver ${plural(riesgos.length, 'alumno', 'alumnos')}`}
            <ChevronDown aria-hidden="true" className={cn('transition-transform duration-150 ease-out', abierto && 'rotate-180')} />
          </Button>
        )}
      />
      <details className="mb-4 text-xs text-muted-foreground">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">¿Cómo se identifica el riesgo?</summary>
        <p className="max-w-3xl pb-3 leading-relaxed">{CRITERIO_RIESGO}</p>
      </details>
      {!riesgos.length ? (
        <p className="border-y border-border py-6 text-sm text-muted-foreground">Ningún alumno cumple el criterio de riesgo en el periodo.</p>
      ) : !abierto ? (
        <p className="border-y border-border py-4 text-[0.8125rem] text-muted-foreground">
          {plural(riesgos.length, 'alumno cumple', 'alumnos cumplen')} el criterio de riesgo. Abre la lista para revisar sus casos.
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
                      <Link className={cn(linkClass, 'text-foreground')} to={j.toDesde(`/jefe-carrera/grupos/${causa.grupo.id}`, { tab: 'alumnos', alumno: alumno.id })}>{alumno.nombre}</Link>
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
            <Link className={`${linkClass} mt-2 inline-flex min-h-11 items-center text-[0.8125rem]`} to={j.toDesde('/jefe-carrera/seguimientos', { seccion: 'pendientes', tipo: 'ALUMNO_RIESGO' })}>Ver los {riesgos.length} alumnos en riesgo</Link>
          )}
        </div>
      )}
    </section>
  )
}

function GrupoDocente({ g, j, seguimientos }) {
  const [abierto, setAbierto] = useState(false)
  const [contacto, setContacto] = useState(false)
  const detalleId = `detalle-${g.key}`
  const contactoId = `contacto-docente-${g.key}`
  const nombre = g.docente?.nombre ?? 'Sin docente asignado'
  const iniciales = nombre.split(/\s+/).slice(0, 2).map((p) => p[0]).join('')
  return (
    <li className="docentes-ficha">
      <div className="docentes-ficha-cuerpo">
        <div className="docentes-cabecera">
          <div className="docentes-identidad">
            <span className="docentes-iniciales" aria-hidden="true">{iniciales}</span>
            <div className="min-w-0">
          {g.docente
            ? <Link className={cn(linkClass, 'docentes-nombre')} to={j.toDesde(`/jefe-carrera/docentes/${g.docente.id}`)}>{nombre}</Link>
            : <span className="text-[0.9375rem] font-medium text-warning-foreground">{nombre}</span>}
              <p className="docentes-fecha">{g.desde ? `Pendiente más antiguo: ${fechaCorta(g.desde)}` : 'Sin listas pendientes'}</p>
            </div>
          </div>
          {g.desde && <span className="docentes-antiguedad"><Clock3 aria-hidden="true" />{haceTiempo(g.desde)}</span>}
        </div>
        <ul className="docentes-cantidades" aria-label={`Pendientes de ${nombre}`}>
          {resumenGrupo(g).map((texto) => { const espacio = texto.indexOf(' '); return <li key={texto}><strong>{texto.slice(0, espacio)}</strong> {texto.slice(espacio + 1)}</li> })}
        </ul>
      </div>
        <div className="docentes-acciones">
          {g.docente && (
            <BotonSeguimiento
              j={j}
              caso={{ tipo: 'SEGUIMIENTO_DOCENTE', docenteId: g.docente.id }}
              titulo={`Observación con ${nombre}`}
              contexto={resumenGrupo(g).join(' · ')}
              className="docentes-observar"
            />
          )}
          {g.docente && <Button variant="outline" size="sm" className="docentes-contacto" aria-expanded={contacto} aria-controls={contactoId} onClick={() => setContacto((v) => !v)}><Phone aria-hidden="true" />Contacto</Button>}
          <Button variant="ghost" size="sm" className="docentes-detalle-boton" aria-expanded={abierto} aria-controls={detalleId} onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar pendientes' : 'Ver pendientes'}
            <ChevronDown aria-hidden="true" className={cn('docentes-flecha', abierto && 'docentes-flecha-abierta')} />
          </Button>
        </div>
      {g.docente && <div id={contactoId} hidden={!contacto} className="docentes-contacto-contenedor"><ContactoDocente key={g.docente.id} docente={g.docente} j={j} /></div>}
        <ul id={detalleId} hidden={!abierto} className="docentes-detalle divide-y divide-border text-[0.8125rem]">
          {g.listas.map((c) => (
            <Detalle
              key={c.id}
              texto={`${fechaCorta(c.fecha)}, ${c.horaInicio} · ${c.materia.nombre} · ${c.grupo.nombre}`}
              estado={<span className={estadoClase(c.estado).texto}>{c.estado === 'CAPTURA_PARCIAL' ? `Captura parcial (${c.registros} de ${c.alumnos})` : 'Sin captura'}</span>}
              seguimiento={seguimientos.buscar({ tipo: 'ASISTENCIA_SIN_CAPTURA', horarioId: c.horarioId, fecha: c.fecha })}
              enlace={{ label: 'Ver clase', to: j.toDesde('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined }) }}
            />
          ))}
          {g.calificaciones.map((o) => (
            <Detalle
              key={`c-${o.id}`}
              texto={`${o.materia.nombre} · ${o.grupo.nombre}`}
              estado={plural(o.resumen.calificacionesPendientes, 'calificación de unidad cerrada sin capturar', 'calificaciones de unidades cerradas sin capturar')}
              seguimiento={seguimientos.buscar({ tipo: 'CALIFICACIONES_PENDIENTES', materiaId: o.materia.id, grupoId: o.grupo.id })}
              enlace={{ label: 'Ver unidades', to: j.toDesde(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id, tab: 'unidades' }) }}
            />
          ))}
          {g.entregas.map((o) => (
            <Detalle
              key={`e-${o.id}`}
              texto={`${o.materia.nombre} · ${o.grupo.nombre}`}
              estado={plural(o.resumen.entregasPendientes, 'entrega recibida sin revisar', 'entregas recibidas sin revisar')}
              enlace={{ label: 'Ver materia en el grupo', to: j.toDesde(`/jefe-carrera/materias/${o.materia.id}`, { oferta: o.grupo.id }) }}
            />
          ))}
          {g.unidades.map(({ unidad, materia, senal }) => (
            <Detalle
              key={`u-${unidad.id}`}
              texto={`${unidad.nombre} · ${materia.nombre}`}
              estado={<span className="text-warning-foreground">{senal}</span>}
              enlace={{ label: 'Ver unidades', to: j.toDesde(`/jefe-carrera/materias/${materia.id}`, { tab: 'unidades' }) }}
            />
          ))}
        </ul>
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
