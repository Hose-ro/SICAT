import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BellRing, Check, CheckCheck, FileText, MessageCircle, Paperclip, Presentation } from 'lucide-react'
import api from '@/api/axios'
import TaskNotice from '@/components/TaskNotice'
import { compartirTareaPorWhatsapp } from '@/components/whatsapp/compartirTarea'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { confirmAction, notify } from '@/lib/feedback'
import { TASK_TYPE_LABEL, conteoEntregas, estadoDocente, plazoTarea, taskError, taskFileUrl } from '@/lib/tareas'
import { cn } from '@/lib/utils'
import { useTareaStore } from '@/store/tareaStore'
import { EstadoTareaChip } from './components/tareas/Estados'
import { MenuAcciones } from './components/tareas/Controles'
import EvidenciaEntrega from './components/tareas/EvidenciaEntrega'
import ListaRevision from './components/tareas/ListaRevision'
import PanelCalificacion from './components/tareas/PanelCalificacion'
import RevisionTerminada, { ResumenRevision } from './components/tareas/RevisionTerminada'
import useAccionesTarea from './components/tareas/useAccionesTarea'

const SIN_ENTREGA = new Set(['PENDIENTE', 'NO_ENTREGADA'])
// Campos que el API devuelve al revisar, calificar o devolver una entrega.
const CAMPOS_ENTREGA = ['estadoRevision', 'calificacion', 'calificacionTipo', 'observacion', 'fechaRevision', 'permiteCorreccion']

function coincideFiltro(fila, filtro) {
  if (filtro === 'TODAS') return true
  if (filtro === 'SIN') return SIN_ENTREGA.has(fila.estado)
  return fila.estado === filtro
}

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function primerNombre(nombre) {
  return String(nombre || '').split(' ')[0]
}

function errorRecordatorio(error) {
  if (error?.response?.status === 404) return 'El servidor todavía no tiene los recordatorios. Actualiza el backend para usarlos.'
  return taskError(error, 'No se pudo enviar el recordatorio. Intenta de nuevo.')
}

/**
 * Sesión de revisión: una entrega a la vez. La lista del grupo a la izquierda,
 * la evidencia al centro y la calificación a la derecha. Calificar guarda en
 * segundo plano y salta a la siguiente entrega pendiente.
 */
function TareaDetalle({ tareaId }) {
  const store = useTareaStore.getState()
  const [fase, setFase] = useState({ estado: 'cargando', error: '' })
  const [tarea, setTarea] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [filtro, setFiltro] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloTardias, setSoloTardias] = useState(false)
  const [seleccion, setSeleccion] = useState(null)
  const [borradores, setBorradores] = useState({})
  const [guardando, setGuardando] = useState({})
  const [ultimo, setUltimo] = useState(null)
  const [reciente, setReciente] = useState(null)
  // En tabletas y celulares la vista previa empujaría la calificación muy abajo: se abre a pedido.
  const [mostrarVista, setMostrarVista] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches)
  const [instrucciones, setInstrucciones] = useState(false)
  const [recordado, setRecordado] = useState(false)
  const [ocupado, setOcupado] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const data = await useTareaStore.getState().obtenerEntregas(tareaId)
      const lista = data.entregas || []
      const inicial = data.tarea?.tipoEntrega !== 'PRESENCIAL' && lista.some((e) => estadoDocente(e) === 'ENTREGADA') ? 'ENTREGADA' : 'TODAS'
      setTarea(data.tarea)
      setEntregas(lista)
      setFiltro((actual) => actual ?? inicial)
      setSeleccion((actual) => actual ?? (lista.find((e) => coincideFiltro({ estado: estadoDocente(e) }, inicial)) ?? lista[0])?.alumno.id ?? null)
      setFase({ estado: 'listo', error: '' })
    } catch (error) {
      setFase({ estado: 'error', error: taskError(error, 'No se pudo cargar la tarea. Vuelve a intentarlo.') })
    }
  }, [tareaId])

  useEffect(() => { cargar() }, [cargar])

  // Al llegar recién publicada desde el formulario, se ofrece mandarla al grupo de WhatsApp.
  const location = useLocation()
  const navigate = useNavigate()
  const compartirPendiente = useRef(Boolean(location.state?.compartir))
  useEffect(() => {
    if (!compartirPendiente.current) return
    compartirPendiente.current = false
    navigate(location.pathname + location.search, { replace: true, state: null })
    compartirTareaPorWhatsapp(tareaId)
  }, [tareaId, navigate, location.pathname, location.search])

  const filas = useMemo(() => entregas.map((entrega) => ({ entrega, alumno: entrega.alumno, estado: estadoDocente(entrega) })), [entregas])
  const r = useMemo(() => conteoEntregas(entregas), [entregas])
  const filtroActivo = filtro ?? 'TODAS'
  const needle = normalizar(busqueda)
  const coincide = useCallback((fila, conFiltro = filtroActivo) => coincideFiltro(fila, conFiltro)
    && (!soloTardias || fila.entrega.fueTardia)
    && (!needle || normalizar(`${fila.alumno.nombre} ${fila.alumno.numeroControl ?? ''}`).includes(needle)), [filtroActivo, soloTardias, needle])
  const visibles = useMemo(() => filas.filter((fila) => coincide(fila)), [filas, coincide])
  const actual = filas.find((fila) => fila.alumno.id === seleccion) ?? visibles[0] ?? filas[0] ?? null
  const posicion = actual ? visibles.findIndex((fila) => fila.alumno.id === actual.alumno.id) : -1

  const mover = (paso) => {
    if (!visibles.length) return
    const base = posicion === -1 ? (paso > 0 ? -1 : visibles.length) : posicion
    setSeleccion(visibles[Math.min(visibles.length - 1, Math.max(0, base + paso))].alumno.id)
  }

  const cambiarFiltro = (valor) => {
    setFiltro(valor)
    const primera = filas.find((fila) => coincide(fila, valor))
    if (primera) setSeleccion(primera.alumno.id)
  }

  // Siguiente entrega por calificar después de `alumnoId`: primero en la lista visible, luego en todo el grupo.
  const siguientePendiente = (alumnoId) => {
    const buscar = (lista) => {
      const i = lista.findIndex((fila) => fila.alumno.id === alumnoId)
      const orden = i === -1 ? lista : [...lista.slice(i + 1), ...lista.slice(0, i)]
      return orden.find((fila) => fila.estado === 'ENTREGADA' && fila.alumno.id !== alumnoId)
    }
    return (buscar(visibles) ?? buscar(filas))?.alumno.id ?? null
  }

  const actualizarEntrega = (alumnoId, cambio) => setEntregas((lista) => lista.map((e) => (e.alumno.id === alumnoId ? { ...e, ...cambio } : e)))
  const marcarGuardando = (alumnoId, valor) => setGuardando((actuales) => {
    const copia = { ...actuales }
    if (valor) copia[alumnoId] = true
    else delete copia[alumnoId]
    return copia
  })
  const soltarBorrador = (alumnoId) => setBorradores((actuales) => {
    const copia = { ...actuales }
    delete copia[alumnoId]
    return copia
  })

  // Cambio optimista: la lista avanza al instante y el API confirma después.
  const registrar = async (fila, { local, llamada, resumen, borrador }) => {
    const { alumno, entrega: previa } = fila
    const siguiente = siguientePendiente(alumno.id)
    actualizarEntrega(alumno.id, local)
    marcarGuardando(alumno.id, true)
    soltarBorrador(alumno.id)
    setUltimo({ alumnoId: alumno.id, nombre: primerNombre(alumno.nombre), texto: resumen })
    setReciente((anterior) => ({ alumnoId: alumno.id, seq: (anterior?.seq ?? 0) + 1 }))
    if (siguiente) setSeleccion(siguiente)
    try {
      const respuesta = await llamada()
      actualizarEntrega(alumno.id, Object.fromEntries(CAMPOS_ENTREGA.filter((campo) => respuesta && campo in respuesta).map((campo) => [campo, respuesta[campo]])))
    } catch (error) {
      actualizarEntrega(alumno.id, previa)
      if (borrador) setBorradores((actuales) => ({ ...actuales, [alumno.id]: borrador }))
      setUltimo((u) => (u?.alumnoId === alumno.id ? null : u))
      notify(`No se guardó lo de ${alumno.nombre}. ${taskError(error)}`, 'error', {
        action: { label: 'Ir a su entrega', onClick: () => setSeleccion(alumno.id) },
      })
    } finally {
      marcarGuardando(alumno.id, false)
    }
  }

  const calificar = (fila, datos, borrador) => registrar(fila, {
    local: {
      estadoRevision: 'CALIFICADA',
      calificacion: datos.calificacionTipo === 'NUMERICA' ? datos.calificacion : null,
      calificacionTipo: datos.calificacionTipo,
      observacion: datos.observacion,
      permiteCorreccion: false,
    },
    llamada: () => store.calificar(fila.entrega.id, datos),
    resumen: datos.calificacionTipo === 'NUMERICA' ? String(datos.calificacion) : datos.calificacionTipo === 'FIRMA' ? 'firma' : 'revisado',
    borrador,
  })

  const revisar = (fila, { observacion }) => registrar(fila, {
    local: { estadoRevision: 'REVISADA', observacion, permiteCorreccion: false },
    llamada: () => store.revisar(fila.entrega.id, observacion),
    resumen: 'revisada',
  })

  const devolver = (fila, { observacion, permiteCorreccion }) => registrar(fila, {
    local: { estadoRevision: 'INCORRECTA', observacion, permiteCorreccion, calificacion: null },
    llamada: () => store.devolverParaCorreccion(fila.entrega.id, observacion, permiteCorreccion),
    resumen: permiteCorreccion ? 'devuelta para corregir' : 'devuelta',
  })

  const ejecutar = async (clave, accion) => {
    if (ocupado) return
    setOcupado(clave)
    try {
      await accion()
    } finally {
      setOcupado(null)
    }
  }

  const registrarPresencial = (fila) => ejecutar(`presencial-${fila.alumno.id}`, async () => {
    try {
      const creada = await store.marcarPresencial(tareaId, fila.alumno.id)
      actualizarEntrega(fila.alumno.id, { ...creada, alumno: fila.alumno, esSintetica: false })
      notify(`Registraste la entrega de ${fila.alumno.nombre}.`, 'success')
    } catch (error) {
      notify(taskError(error))
    }
  })

  const registrarTodos = () => ejecutar('presencial-todos', async () => {
    const faltan = filas.filter((fila) => fila.entrega.esSintetica)
    if (!faltan.length) return
    if (!(await confirmAction({ title: 'Registrar al grupo completo', description: `Se registrará la entrega en clase de ${faltan.length} ${faltan.length === 1 ? 'alumno' : 'alumnos'}.`, confirmLabel: 'Registrar' }))) return
    let fallidas = 0
    for (let i = 0; i < faltan.length; i += 5) {
      const lote = await Promise.allSettled(faltan.slice(i, i + 5).map((fila) => store.marcarPresencial(tareaId, fila.alumno.id)))
      lote.forEach((resultado, j) => {
        const fila = faltan[i + j]
        if (resultado.status === 'fulfilled') actualizarEntrega(fila.alumno.id, { ...resultado.value, alumno: fila.alumno, esSintetica: false })
        else fallidas += 1
      })
    }
    if (fallidas) notify(`No se registraron ${fallidas} entregas. Intenta de nuevo con esos alumnos.`)
    else notify(`Registraste la entrega de ${faltan.length} ${faltan.length === 1 ? 'alumno' : 'alumnos'}.`, 'success')
  })

  const revisarPendientes = () => ejecutar('masivo', async () => {
    const pendientes = filas.filter((fila) => fila.estado === 'ENTREGADA')
    if (!pendientes.length) return
    if (!(await confirmAction({ title: 'Marcar como revisadas', description: `${pendientes.length} ${pendientes.length === 1 ? 'entrega quedará revisada' : 'entregas quedarán revisadas'}, sin calificación numérica. Cada alumno recibirá un aviso.`, confirmLabel: 'Marcar revisadas' }))) return
    try {
      await store.revisarMasivo(tareaId, pendientes.map((fila) => fila.entrega.id))
      pendientes.forEach((fila) => actualizarEntrega(fila.alumno.id, { estadoRevision: 'REVISADA', permiteCorreccion: false }))
      notify(`${pendientes.length} ${pendientes.length === 1 ? 'entrega marcada' : 'entregas marcadas'} como revisadas.`, 'success')
    } catch (error) {
      notify(taskError(error))
    }
  })

  const recordar = (alumnoIds) => ejecutar('recordar', async () => {
    try {
      const { enviados = 0, omitidos = 0 } = await store.recordar(tareaId, alumnoIds)
      if (!alumnoIds) setRecordado(true)
      notify(enviados
        ? `Enviaste el recordatorio a ${enviados} ${enviados === 1 ? 'alumno' : 'alumnos'}.${omitidos ? ` ${omitidos} ya lo habían recibido en las últimas 12 horas.` : ''}`
        : 'Ya recibieron un recordatorio en las últimas 12 horas.', 'success')
    } catch (error) {
      notify(errorRecordatorio(error))
    }
  })

  const cerrarTarea = () => ejecutar('cerrar', async () => {
    try {
      const actualizada = await store.cerrar(tareaId)
      setTarea((t) => ({ ...t, ...actualizada }))
      notify('La tarea ya no recibe entregas.', 'success', {
        action: {
          label: 'Deshacer',
          onClick: () => store.reabrir(tareaId).then((reabierta) => setTarea((t) => ({ ...t, ...reabierta }))).catch((error) => notify(taskError(error))),
        },
      })
    } catch (error) {
      notify(taskError(error))
    }
  })

  const onCambio = useCallback((actualizada) => { if (actualizada) setTarea((t) => ({ ...t, ...actualizada })) }, [])
  const menuTarea = useAccionesTarea({ onCambio })

  const onTecla = useEffectEvent((event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey) return
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable
    if (escribiendo && !event.altKey) return
    if (document.querySelector('[role="dialog"], [role="menu"]')) return
    if (event.key === 'ArrowDown') { event.preventDefault(); mover(1) }
    if (event.key === 'ArrowUp') { event.preventDefault(); mover(-1) }
  })
  useEffect(() => {
    const manejar = (event) => onTecla(event)
    document.addEventListener('keydown', manejar)
    return () => document.removeEventListener('keydown', manejar)
  }, [])

  if (fase.estado === 'cargando') {
    return (
      <div role="status" aria-label="Cargando entregas" className="mx-auto max-w-[90rem] space-y-4">
        <Skeleton className="h-8 w-2/3 max-w-xl rounded-[10px]" />
        <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-[var(--radius-card)]" />
          <Skeleton className="h-96 rounded-[var(--radius-card)]" />
        </div>
      </div>
    )
  }

  if (fase.estado === 'error' || !tarea) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/tareas" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Tareas</Link>
        <TaskNotice error={fase.error || 'No se pudo cargar la tarea.'} onRetry={() => { setFase({ estado: 'cargando', error: '' }); cargar() }} />
      </div>
    )
  }

  const presencial = tarea.tipoEntrega === 'PRESENCIAL'
  const vencida = tarea.estado === 'VENCIDA' || tarea.estado === 'CERRADA'
  const abierta = tarea.estado === 'PUBLICADA' || tarea.estado === 'VENCIDA'
  const p = plazoTarea(tarea)
  const volver = `/tareas?materia=${tarea.materiaId}${tarea.grupoId ? `&grupo=${tarea.grupoId}` : ''}`
  const terminado = !presencial && r.porCalificar === 0 && r.entregadas > 0 && Boolean(actual) && ultimo?.alumnoId === actual.alumno.id

  const itemsMenu = menuTarea(tarea, [
    { label: instrucciones ? 'Ocultar instrucciones' : 'Ver instrucciones', icon: FileText, onSelect: () => setInstrucciones((valor) => !valor) },
    !presencial && r.porCalificar > 0 && { label: `Marcar las ${r.porCalificar} por calificar como revisadas`, icon: CheckCheck, onSelect: revisarPendientes },
    presencial && abierta && r.sinEntregar > 0 && { label: `Registrar en clase a los ${r.sinEntregar} que faltan`, icon: Presentation, onSelect: registrarTodos },
    !presencial && abierta && r.sinEntregar > 0 && { label: 'Recordar a quienes faltan', icon: BellRing, onSelect: () => recordar() },
    abierta && { label: 'Recordatorio por WhatsApp', icon: MessageCircle, onSelect: () => compartirTareaPorWhatsapp(tareaId, { recordatorio: true }) },
    { separator: true },
  ])

  let panel = null
  if (actual) {
    if (actual.entrega.esSintetica && presencial) {
      panel = (
        <div>
          <h2 className="text-sm font-semibold text-foreground">Entrega presencial</h2>
          <p className="mt-1 text-sm text-muted-foreground">Registra que {primerNombre(actual.alumno.nombre)} entregó en clase; después puedes calificarla.</p>
          <Button className="mt-4 w-full" onClick={() => registrarPresencial(actual)} disabled={Boolean(ocupado) || tarea.estado === 'CERRADA'}>
            {ocupado === `presencial-${actual.alumno.id}` ? 'Registrando…' : 'Registrar entrega'}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => mover(1)}>Pasar al siguiente</Button>
        </div>
      )
    } else if (actual.entrega.esSintetica) {
      panel = (
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sin entrega</h2>
          <p className="mt-1 text-sm text-muted-foreground">No hay nada que calificar todavía.</p>
          {abierta && (
            <Button variant="outline" className="mt-4 w-full" onClick={() => recordar([actual.alumno.id])} disabled={ocupado === 'recordar'}>
              <BellRing aria-hidden="true" />Recordarle
            </Button>
          )}
          <Button variant="ghost" className="mt-2 w-full" onClick={() => mover(1)}>Pasar al siguiente</Button>
        </div>
      )
    } else {
      panel = (
        <PanelCalificacion key={actual.alumno.id} tarea={tarea} fila={actual} borrador={borradores[actual.alumno.id]}
          onBorrador={(datos) => setBorradores((actuales) => ({ ...actuales, [actual.alumno.id]: { ...actuales[actual.alumno.id], ...datos } }))}
          onCalificar={(datos, borrador) => calificar(actual, datos, borrador)}
          onRevisar={(datos) => revisar(actual, datos)}
          onDevolver={(datos) => devolver(actual, datos)} />
      )
    }
  }

  return (
    <div className="@container mx-auto max-w-[90rem]">
      <Link to={volver} className="inline-flex min-h-9 items-center gap-2 rounded-[10px] text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {tarea.materia?.nombre}{tarea.grupo?.nombre ? ` · ${tarea.grupo.nombre}` : ''}{tarea.unidadRef ? ` · Unidad ${tarea.unidadRef.orden}` : ''}
      </Link>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground">{tarea.titulo}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {TASK_TYPE_LABEL[tarea.tipoEntrega] ?? tarea.tipoEntrega} · {tarea.tipoEvaluacion === 'RUBRICA' ? 'Rúbrica' : 'Calificación directa'} · {p.relativo}{p.texto ? `, ${p.texto}` : ''}
            {tarea.permiteReenvio && ' · Permite reenvío'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoTareaChip estado={tarea.estado} />
          <MenuAcciones label="Más acciones de la tarea" items={itemsMenu} />
        </div>
      </header>

      {instrucciones && (
        <div className="mt-3 max-w-3xl rounded-[14px] bg-muted px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{tarea.instrucciones}</p>
          {tarea.archivos?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {tarea.archivos.map((archivo) => (
                <li key={archivo.id}>
                  <a href={taskFileUrl(archivo.url, api.defaults.baseURL)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                    <Paperclip className="size-3.5" aria-hidden="true" />{archivo.nombre}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!filas.length ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">Esta tarea todavía no tiene alumnos.</p>
          <p className="mt-1 text-sm text-muted-foreground">Aparecerán cuando haya inscripciones aceptadas en el grupo.</p>
        </div>
      ) : (
        <div className="mt-5 grid items-start gap-4 @min-[40rem]:grid-cols-[minmax(0,1fr)_18rem] @min-[56rem]:grid-cols-[15rem_minmax(0,1fr)_18.5rem] @min-[66rem]:grid-cols-[16.5rem_minmax(0,1fr)_20rem]">
          <ListaRevision filas={filas} visibles={visibles} r={r} presencial={presencial} vencida={vencida}
            filtro={filtroActivo} onFiltro={cambiarFiltro} busqueda={busqueda} onBusqueda={setBusqueda}
            soloTardias={soloTardias} onSoloTardias={setSoloTardias} seleccion={actual?.alumno.id}
            onSeleccion={setSeleccion} guardando={guardando} reciente={reciente}
            recordado={recordado} recordando={ocupado === 'recordar'} onRecordar={() => recordar()} />

          {terminado ? <ResumenRevision filas={filas} r={r} /> : actual && (
            <EvidenciaEntrega key={actual.alumno.id} tarea={tarea} fila={actual} posicion={posicion} total={visibles.length}
              onMover={mover} mostrarVista={mostrarVista} onMostrarVista={setMostrarVista} />
          )}

          <section aria-label="Calificación"
            className="rounded-[var(--radius-card)] border border-border bg-card p-5 @min-[40rem]:sticky @min-[40rem]:top-4">
            {terminado ? (
              <RevisionTerminada r={r} tarea={tarea} volver={volver} recordado={recordado} recordando={ocupado === 'recordar'}
                cerrando={ocupado === 'cerrar'} onRecordar={() => recordar()} onCerrar={cerrarTarea} />
            ) : (
              <>
                {ultimo && ultimo.alumnoId !== actual?.alumno.id && (
                  <p className="mb-4 flex items-center justify-between gap-2 rounded-[12px] bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <span>
                      <Check className="mr-1 inline size-3.5 text-success" aria-hidden="true" />
                      {ultimo.nombre}: <span className={cn('font-semibold text-foreground', /^\d/.test(ultimo.texto) && 'tabular-nums')}>{ultimo.texto}</span>
                    </span>
                    <button type="button" onClick={() => setSeleccion(ultimo.alumnoId)} className="font-medium text-primary-ink underline-offset-4 hover:underline">
                      Cambiar
                    </button>
                  </p>
                )}
                {panel}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

// Cada tarea monta su propia sesión: cambiar de tarea no arrastra filtros ni borradores.
export default function TareaDetalleRuta() {
  const { id } = useParams()
  return <TareaDetalle key={id} tareaId={Number(id)} />
}
