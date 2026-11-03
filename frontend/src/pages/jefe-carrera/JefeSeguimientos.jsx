import { useMemo, useState } from 'react'
import { CalendarX2, ChevronRight, ClipboardX, FilePen, Inbox, Layers, UserRoundX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import SexoBadge from '@/components/SexoBadge'
import { MOTIVOS_RIESGO, estadoClase } from './supervision/estados'
import { fechaCorta, fechaHoraCorta, haceTiempo, modalidadTexto, plural } from './supervision/formato'
import { TIPOS_PENDIENTE, calendariosFaltantes, conteoPorTipo, filtrarPendientes, pendientesAcademicos } from './supervision/pendientes'
import { Aviso, Esqueleto, JefaturaPage, Pestanas, Vacio, linkClass, selectClass } from './supervision/ui'
import { BotonSeguimiento, EstadoSeguimiento, FormSeguimiento } from './supervision/Seguimiento'
import { FiltroChip } from './supervision/senales'
import { TIPOS_SEGUIMIENTO, esParaHoy, useSeguimientos } from './supervision/useSeguimientos'
import './seguimientos.css'

const VISTAS = [
  { value: 'abiertos', label: 'Abiertos', filtro: (s) => s.abierto },
  { value: 'hoy', label: 'Para revisar hoy', filtro: esParaHoy },
  { value: 'cerrados', label: 'Cerrados', filtro: (s) => !s.abierto },
]

const POR_PAGINA = 40
/** Pendientes que muestra cada tipo dentro de «Todos». */
const PREVIA = 3

/**
 * Sección de la vista. Los enlaces anteriores con ?vista=abiertos|hoy|cerrados
 * siguen abriendo las observaciones; sin parámetros se abre «Por atender».
 */
function leerSeccion(params) {
  const pedida = params.get('seccion')
  if (pedida === 'observaciones' || pedida === 'pendientes') return pedida
  return VISTAS.some((v) => v.value === params.get('vista')) ? 'observaciones' : 'pendientes'
}

/** Enlace a una sección conservando solo los filtros que significan lo mismo en ella. */
function enlaceSeccion(params, seccion) {
  const next = new URLSearchParams(params)
  next.set('seccion', seccion)
  const tipo = next.get('tipo')
  if (seccion === 'pendientes') {
    next.delete('vista')
    if (tipo && !TIPOS_PENDIENTE[tipo]) next.delete('tipo')
  } else {
    next.delete('grupo')
    if (tipo && !TIPOS_SEGUIMIENTO[tipo]) next.delete('tipo')
  }
  return `?${next}`
}

/**
 * Enlace al registro que explica el caso y si su causa sigue presente. Que el
 * caso ya no aparezca en el resumen no prueba que se resolvió (pudo cambiar
 * la configuración o el alcance): solo se afirma lo que puede verificarse.
 */
function contextoCaso(s, resumen, j) {
  const ref = s.referencia
  if (!ref) return { enlace: null, causa: null }
  switch (ref.tipo) {
    case 'ASISTENCIA_SIN_CAPTURA': {
      const id = `${ref.horarioId}:${ref.fecha}`
      const pendiente = resumen.pendientes.find((c) => c.id === id)
      const modalidad = resumen.ofertas.flatMap((o) => o.horarios).find((h) => h.id === ref.horarioId)?.grupo?.modalidad
      return {
        enlace: { label: 'Ver clase', to: j.toDesde('/jefe-carrera/horarios', { fecha: ref.fecha, clase: id, modalidad: modalidad === 'MIXTO' ? 'MIXTO' : undefined }) },
        causa: pendiente ? { texto: 'La lista de asistencia sigue sin captura completa', tono: 'pendiente' } : { texto: 'Ya no aparece entre las listas de asistencia pendientes; abre la clase para confirmar su estado', tono: 'sin-verificar' },
      }
    }
    case 'ALUMNO_RIESGO': {
      const alumno = resumen.riesgos.find((a) => a.id === ref.alumnoId)
      const grupo = alumno?.causas[0]?.grupo
      return {
        enlace: grupo ? { label: 'Ver expediente', to: j.toDesde(`/jefe-carrera/grupos/${grupo.id}`, { tab: 'riesgo', alumno: ref.alumnoId }) } : null,
        causa: alumno ? { texto: 'Sigue con señales de riesgo', tono: 'pendiente' } : { texto: 'No aparece entre los alumnos en riesgo del periodo; no se puede verificar la causa desde aquí', tono: 'sin-verificar' },
      }
    }
    case 'CALIFICACIONES_PENDIENTES': {
      const oferta = resumen.ofertas.find((o) => o.id === `${ref.materiaId}:${ref.grupoId}`)
      const n = oferta?.resumen.calificacionesPendientes ?? 0
      return {
        enlace: { label: 'Ver unidades', to: j.toDesde(`/jefe-carrera/materias/${ref.materiaId}`, { oferta: ref.grupoId, tab: 'unidades' }) },
        causa: !oferta
          ? { texto: 'La materia ya no aparece en el grupo para este periodo; no se puede verificar la causa', tono: 'sin-verificar' }
          : n ? { texto: `Siguen ${plural(n, 'calificación pendiente', 'calificaciones pendientes')}`, tono: 'pendiente' } : { texto: 'Calificaciones de unidades cerradas capturadas', tono: 'resuelto' },
      }
    }
    case 'SEGUIMIENTO_DOCENTE':
      return { enlace: { label: 'Ver docente', to: j.toDesde(`/jefe-carrera/docentes/${ref.docenteId}`) }, causa: null }
    default:
      return { enlace: null, causa: null }
  }
}

const TONO_CAUSA = { pendiente: 'text-warning-foreground', resuelto: 'text-success-foreground', 'sin-verificar': 'text-muted-foreground' }

export default function JefeSeguimientos() {
  return (
    <JefaturaPage titulo="Pendientes y seguimiento">
      {({ j, resumen }) => <Contenido j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

function Contenido({ j, resumen }) {
  const [params] = useSearchParams()
  const seccion = leerSeccion(params)
  const seguimientos = useSeguimientos({ carreraId: j.carreraId, periodo: j.periodo })

  return (
    <>
      <Pestanas
        label="Secciones de pendientes y seguimiento"
        activa={seccion}
        items={[
          { value: 'pendientes', label: 'Por atender', to: enlaceSeccion(params, 'pendientes') },
          { value: 'observaciones', label: 'Observaciones registradas', to: enlaceSeccion(params, 'observaciones') },
        ]}
      />
      {seccion === 'pendientes'
        ? <Pendientes j={j} resumen={resumen} seguimientos={seguimientos} />
        : <Observaciones j={j} resumen={resumen} seguimientos={seguimientos} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Por atender: pendientes académicos detectados, con o sin observación */

function Pendientes({ j, resumen, seguimientos }) {
  const [params, setParams] = useSearchParams()
  const [limite, setLimite] = useState(POR_PAGINA)
  const items = useMemo(() => pendientesAcademicos(resumen), [resumen])
  const tipo = TIPOS_PENDIENTE[params.get('tipo')] ? params.get('tipo') : ''
  const docente = params.get('docente') ?? ''
  const grupo = params.get('grupo') ?? ''
  const set = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
    setParams(next, { replace: true })
  }
  const enlaceTipo = (valor) => {
    const next = new URLSearchParams(params)
    next.set('seccion', 'pendientes')
    if (valor) next.set('tipo', valor); else next.delete('tipo')
    return `?${next}`
  }

  const vacia = resumen.ofertas.length === 0 && resumen.grupos.length === 0
  if (vacia) {
    return (
      <Vacio titulo="La carrera todavía no tiene grupos ni materias en el periodo" accion={<Link className={linkClass} to={j.to('/dashboard')}>Ver la guía en Inicio</Link>}>
        Sin oferta no hay listas de asistencia, calificaciones ni alumnos que supervisar.
      </Vacio>
    )
  }

  const sinCalendario = calendariosFaltantes(resumen)
  const filtroSinTipo = filtrarPendientes(items, { docente, grupo })
  const conteo = conteoPorTipo(filtroSinTipo)
  const visibles = filtrarPendientes(filtroSinTipo, { tipo })
  const filtrando = Boolean(docente || grupo)
  const docentes = [...new Map(items.flatMap((p) => p.docentes).map((d) => [String(d.id), d.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  const haySinDocente = items.some((p) => !p.docentes.length)
  const grupos = [...resumen.grupos].sort((a, b) => a.semestre - b.semestre || a.nombre.localeCompare(b.nombre, 'es'))
  const titulo = tipo ? TIPOS_PENDIENTE[tipo].label : 'Todos los pendientes'
  const elegirTipo = () => { setLimite(POR_PAGINA); window.scrollTo({ top: 0 }) }

  return (
    <section aria-labelledby="pendientes-titulo" className="pendientes mt-6">
      <nav aria-label="Tipo de pendiente" className="filtros-chips">
        {[['', 'Todos', filtroSinTipo.length], ...Object.entries(TIPOS_PENDIENTE).map(([valor, t]) => [valor, t.corto, conteo[valor]])]
          .map(([valor, label, n]) => (
            <FiltroChip key={valor || 'todos'} to={enlaceTipo(valor)} activo={tipo === valor} tipo={valor || undefined} n={valor ? n : filtroSinTipo.length} onClick={elegirTipo}>
              {label}
            </FiltroChip>
          ))}
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select aria-label="Docente" value={docente} onChange={(e) => set({ docente: e.target.value })} className={`${selectClass} pendientes-select`}>
          <option value="">Todos los docentes</option>
          {haySinDocente && <option value="sin-docente">Sin docente asignado</option>}
          {docentes.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <select aria-label="Grupo" value={grupo} onChange={(e) => set({ grupo: e.target.value })} className={`${selectClass} pendientes-select`}>
          <option value="">Todos los grupos</option>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre} · {modalidadTexto(g.modalidad)}</option>)}
        </select>
        {filtrando && <Button variant="ghost" className="min-h-11" onClick={() => set({ docente: '', grupo: '' })}>Restablecer filtros</Button>}
      </div>

      <h2 id="pendientes-titulo" className="sr-only">{titulo}</h2>
      {j.historico && <p className="mt-4 text-xs text-muted-foreground">Periodo anterior: las observaciones solo se consultan.</p>}

      {sinCalendario.length > 0 && (!tipo || tipo === 'ASISTENCIA_SIN_CAPTURA') && (
        <p className="mt-5 rounded-[var(--radius-item)] border border-warning/35 bg-warning/18 px-4 py-3 text-xs text-foreground">
          <b className="font-medium">Listas de asistencia no evaluables en {sinCalendario.map((c) => modalidadTexto(c.modalidad)).join(' y ')}:</b> falta su calendario escolar del periodo.
        </p>
      )}
      {seguimientos.error && (
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-item)] border border-warning/35 bg-warning/18 px-4 py-3 text-[0.8125rem] text-foreground">
          <span>No se pudo consultar el seguimiento: los pendientes se muestran completos, pero no si ya tienen observación.</span>
          <Button variant="outline" size="sm" onClick={seguimientos.reintentar}>Reintentar</Button>
        </div>
      )}

      {!items.length ? (
        <Vacio titulo="Sin pendientes detectados en el periodo">
          {sinCalendario.length
            ? 'Las listas de asistencia de la modalidad sin calendario no se pueden evaluar.'
            : 'Listas de asistencia, calificaciones, entregas, unidades y alumnos al corriente.'}
        </Vacio>
      ) : !visibles.length ? (
        <Vacio titulo="Ningún pendiente coincide con los filtros" accion={<Button variant="outline" onClick={() => set(filtrando ? { docente: '', grupo: '' } : { tipo: '' })}>{filtrando ? 'Restablecer filtros' : 'Ver todos los tipos'}</Button>} />
      ) : !tipo ? (
        <div className="pendientes-secciones">
          {Object.keys(TIPOS_PENDIENTE).map((valor) => {
            const lista = visibles.filter((p) => p.tipo === valor)
            if (!lista.length) return null
            return (
              <section key={valor} aria-labelledby={`pendientes-${valor}`}>
                <Link to={enlaceTipo(valor)} className="pendientes-categoria" onClick={elegirTipo}>
                  <IconoPendiente tipo={valor} />
                  <h3 id={`pendientes-${valor}`}>{TIPOS_PENDIENTE[valor].label}</h3>
                  <span className="pendientes-categoria-conteo">{lista.length}</span>
                  {lista.length > PREVIA && <span className="pendientes-categoria-ver">Ver todas<ChevronRight aria-hidden="true" /></span>}
                </Link>
                <ul className="pendientes-lista">
                  {lista.slice(0, PREVIA).map((p) => <FilaPendiente key={p.key} p={p} j={j} seguimientos={seguimientos} />)}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <>
          <ul className="pendientes-lista mt-6">
            {visibles.slice(0, limite).map((p) => <FilaPendiente key={p.key} p={p} j={j} seguimientos={seguimientos} />)}
          </ul>
          {visibles.length > limite && (
            <Button variant="ghost" className="mt-2 min-h-11" onClick={() => setLimite((n) => n + POR_PAGINA)}>
              Mostrar {Math.min(POR_PAGINA, visibles.length - limite)} más de {visibles.length}
            </Button>
          )}
        </>
      )}
    </section>
  )
}


/** El icono acompaña siempre al color de la categoría. */
const ICONOS_PENDIENTE = {
  ASISTENCIA_SIN_CAPTURA: ClipboardX,
  CALIFICACIONES_PENDIENTES: FilePen,
  ALUMNO_RIESGO: UserRoundX,
  ENTREGAS: Inbox,
  UNIDAD: Layers,
  ASIGNACION: CalendarX2,
}

function IconoPendiente({ tipo }) {
  const Icono = ICONOS_PENDIENTE[tipo]
  return <span className="pendientes-icono tono-fondo" data-tono={tipo} aria-hidden="true"><Icono strokeWidth={1.9} /></span>
}

const nombres = (lista) => lista.map((x) => x.nombre).join(', ')

/** Semanas o días transcurridos, en corto. */
function haceCorto(clave) {
  const texto = haceTiempo(clave)
  const m = texto.match(/^Hace (\d+) (días|semanas?)$/)
  return m ? `${m[1]} ${m[2].startsWith('d') ? 'd' : 'sem'}` : texto.toLowerCase()
}

/**
 * Lo que identifica el caso (materia o alumno), qué falla, dónde y quién.
 * La categoría ya la dice su sección o el filtro, así que no se repite.
 */
function describir(p, j) {
  const docentes = p.docentes.length ? nombres(p.docentes) : 'Sin docente asignado'
  const grupos = p.grupos.map((g) => `Grupo ${g.nombre}`).join(', ')
  switch (p.tipo) {
    case 'ASISTENCIA_SIN_CAPTURA': {
      const c = p.clase
      return {
        titulo: c.materia.nombre,
        estado: c.estado === 'CAPTURA_PARCIAL' ? `Parcial · ${c.registros} de ${c.alumnos}` : c.estado === 'SIN_CAPTURA' ? null : estadoClase(c.estado).label,
        contexto: [grupos, docentes],
        cuando: { fecha: `${fechaCorta(c.fecha)}, ${c.horaInicio}`, hace: haceCorto(c.fecha) },
        evidencia: { label: 'Ver clase', to: j.toDesde('/jefe-carrera/horarios', { fecha: c.fecha, clase: c.id, modalidad: c.grupo.modalidad === 'MIXTO' ? 'MIXTO' : undefined }) },
      }
    }
    case 'CALIFICACIONES_PENDIENTES':
      return {
        titulo: p.materia.nombre,
        estado: plural(p.cantidad, 'calificación sin capturar', 'calificaciones sin capturar'),
        contexto: [grupos, docentes],
        evidencia: { label: 'Ver unidades', to: j.toDesde(`/jefe-carrera/materias/${p.materia.id}`, { oferta: p.oferta.grupo.id, tab: 'unidades' }) },
      }
    case 'ALUMNO_RIESGO':
      return {
        titulo: p.alumno.nombre,
        alumno: p.alumno,
        estado: p.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · '),
        contexto: [p.materias.join(', '), grupos],
        evidencia: p.grupos[0] ? { label: 'Ver expediente', to: j.toDesde(`/jefe-carrera/grupos/${p.alumno.causas[0].grupo.id}`, { tab: 'alumnos', alumno: p.alumno.id }) } : null,
      }
    case 'ENTREGAS':
      return {
        titulo: p.materia.nombre,
        estado: `${p.cantidad} sin revisar`,
        contexto: [grupos, docentes],
        evidencia: { label: 'Ver materia en el grupo', to: j.toDesde(`/jefe-carrera/materias/${p.materia.id}`, { oferta: p.oferta.grupo.id }) },
      }
    case 'UNIDAD':
      return {
        titulo: p.materia.nombre,
        estado: `${p.unidad.nombre}: ${p.senal}`,
        contexto: [grupos, docentes],
        evidencia: { label: 'Ver unidades', to: j.toDesde(`/jefe-carrera/materias/${p.materia.id}`, { oferta: p.oferta?.grupo.id, tab: 'unidades' }) },
      }
    case 'ASIGNACION':
      return {
        titulo: p.materia.nombre,
        estado: p.faltaDocente && p.faltaHorario ? 'Sin docente ni horario' : p.faltaDocente ? 'Sin docente' : 'Sin horario',
        contexto: [grupos, p.docentes.length ? docentes : null],
        evidencia: { label: 'Ver materia en el grupo', to: j.toDesde(`/jefe-carrera/materias/${p.materia.id}`, { oferta: p.oferta.grupo.id }) },
      }
    default:
      return { titulo: p.key, contexto: [], evidencia: null }
  }
}

function FilaPendiente({ p, j, seguimientos }) {
  const d = describir(p, j)
  const tipo = TIPOS_PENDIENTE[p.tipo]
  return (
    <li className="pendientes-fila">
      <div className="min-w-0">
        <p className="pendientes-titulo">
          {d.alumno && <SexoBadge sexo={d.alumno.sexo} />}
          {d.evidencia ? <Link className="pendientes-enlace" to={d.evidencia.to} title={d.evidencia.label}>{d.titulo}</Link> : <span>{d.titulo}</span>}
          {d.estado && <span className="senal" data-tono={p.tipo}>{d.estado}</span>}
        </p>
        <p className="pendientes-meta">{d.contexto.filter(Boolean).join(' · ')}</p>
      </div>
      <p className="pendientes-cuando">
        {d.cuando && <><span className="text-foreground first-letter:uppercase">{d.cuando.fecha}</span><span className="pendientes-hace">{d.cuando.hace}</span></>}
      </p>
      <div className="pendientes-acciones">
        {tipo.caso && <EstadoObservacion j={j} p={p} d={d} seguimientos={seguimientos} />}
      </div>
    </li>
  )
}

/** Botón de observación del caso; los tipos sin caso propio no lo llevan. */
function EstadoObservacion({ p, j, d, seguimientos }) {
  if (seguimientos.cargando) return <span className="text-xs text-muted-foreground">Consultando…</span>
  if (seguimientos.error) return <span className="text-xs text-muted-foreground">Observación no disponible</span>
  return (
    <BotonSeguimiento
      compacto
      j={j}
      caso={p.caso}
      titulo={d.alumno ? `Observación sobre ${d.alumno.nombre}` : `${d.titulo} · ${d.contexto[0] ?? ''}`}
      contexto={[d.estado ?? TIPOS_PENDIENTE[p.tipo].label, ...d.contexto].filter(Boolean).join(' · ')}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Observaciones registradas: el historial de acuerdos                 */

function Observaciones({ j, resumen, seguimientos }) {
  const [params, setParams] = useSearchParams()
  const [abierto, setAbierto] = useState(null)
  const vista = VISTAS.find((v) => v.value === params.get('vista')) ?? VISTAS[0]
  const tipo = TIPOS_SEGUIMIENTO[params.get('tipo')] ? params.get('tipo') : ''
  const docente = params.get('docente') ?? ''
  const set = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
    setParams(next, { replace: true })
  }

  if (seguimientos.cargando) return <Esqueleto compacto />
  if (seguimientos.error && !seguimientos.lista.length) {
    return <Aviso tono="error" titulo="No se pudieron cargar las observaciones" accion={<Button variant="outline" onClick={seguimientos.reintentar}>Reintentar</Button>}>{seguimientos.error} Los pendientes del periodo siguen disponibles en «Por atender».</Aviso>
  }

  const responsables = [...new Map(seguimientos.lista.filter((s) => s.responsable).map((s) => [String(s.responsable.id), s.responsable.nombre])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
  const filtrados = seguimientos.lista.filter((s) => (!tipo || s.tipo === tipo) && (!docente || String(s.responsable?.id) === docente))
  const visibles = filtrados.filter(vista.filtro)
  const seleccionado = abierto ? seguimientos.lista.find((s) => s.id === abierto) : null

  return (
    <section aria-labelledby="observaciones-titulo" className="mt-6">
      <h2 id="observaciones-titulo" className="sr-only">Observaciones registradas</h2>
      <p className="max-w-3xl text-xs text-muted-foreground">
        Acuerdos y revisiones del periodo. Cada nota queda con su autor y su fecha. Cerrar una observación no corrige el pendiente: si la causa sigue, aparece en «Por atender».
      </p>
      <Pestanas
        label="Vista de observaciones"
        activa={vista.value}
        items={VISTAS.map((v) => {
          const query = new URLSearchParams(params)
          query.set('seccion', 'observaciones')
          query.set('vista', v.value)
          return { value: v.value, label: v.label, count: filtrados.filter(v.filtro).length, to: `?${query}` }
        })}
      />

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-56">
          <span className="text-xs font-medium text-muted-foreground">Tipo de caso</span>
          <select value={tipo} onChange={(e) => set({ tipo: e.target.value })} className={`${selectClass} mt-1.5`}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_SEGUIMIENTO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="w-full sm:w-64">
          <span className="text-xs font-medium text-muted-foreground">Docente</span>
          <select value={docente} onChange={(e) => set({ docente: e.target.value })} className={`${selectClass} mt-1.5`}>
            <option value="">Todos los docentes</option>
            {responsables.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </label>
        {(tipo || docente) && <Button variant="ghost" className="min-h-11" onClick={() => set({ tipo: '', docente: '' })}>Quitar filtros</Button>}
      </div>

      {visibles.length ? (
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {visibles.map((s) => {
            const { enlace, causa } = contextoCaso(s, resumen, j)
            const ultima = s.notas.at(-1)
            return (
              <li key={s.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] md:gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{[TIPOS_SEGUIMIENTO[s.tipo], s.mensaje].filter(Boolean).join(' · ')}</p>
                  {causa && <p className={`mt-1 text-xs ${TONO_CAUSA[causa.tono]}`}>{causa.texto}</p>}
                  {enlace && <Link className={`${linkClass} mt-1 inline-flex min-h-11 items-center text-xs md:min-h-0`} to={enlace.to}>{enlace.label}</Link>}
                </div>
                <div className="min-w-0 text-[0.8125rem]">
                  {ultima && (
                    <>
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{ultima.autor}</span> · {fechaHoraCorta(ultima.creadoEn)}{s.notas.length > 1 ? ` · ${plural(s.notas.length, 'nota', 'notas')}` : ''}</p>
                      <p className="mt-0.5 line-clamp-2 text-foreground">{ultima.texto}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-col md:items-end">
                  <EstadoSeguimiento seguimiento={s} />
                  <Button variant="outline" size="sm" onClick={() => setAbierto(s.id)}>{j.historico ? 'Ver historial' : 'Agregar nota'}</Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Vacio titulo={seguimientos.lista.length ? 'Nada en esta vista' : 'Todavía no hay observaciones en el periodo'}>
          {seguimientos.lista.length
            ? (tipo || docente ? 'Ninguna observación coincide con los filtros.' : vista.value === 'hoy' ? 'Ningún caso abierto tiene revisión programada para hoy.' : 'No hay casos en esta vista.')
            : 'Regístralas desde «Por atender», el detalle de una clase o la ficha de un docente. Aquí quedará el historial.'}
        </Vacio>
      )}

      <Modal open={Boolean(seleccionado)} onClose={() => setAbierto(null)} title={seleccionado?.titulo} description={seleccionado?.mensaje} wide>
        {seleccionado && (
          <FormSeguimiento
            j={j}
            caso={seleccionado.referencia}
            seguimientoId={seleccionado.id}
            onCancelar={() => setAbierto(null)}
            onGuardado={(s) => { if (!s.abierto) setAbierto(null) }}
          />
        )}
      </Modal>
    </section>
  )
}
