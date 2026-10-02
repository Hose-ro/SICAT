import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CopyPlus, FileDown, FileSpreadsheet, FolderDown, Plus, Search } from 'lucide-react'
import api from '@/api/axios'
import TaskNotice from '@/components/TaskNotice'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Skeleton } from '@/components/ui/skeleton'
import { confirmAction, notify } from '@/lib/feedback'
import { conteoTarea, plazoTarea, taskError } from '@/lib/tareas'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useTareaStore } from '@/store/tareaStore'
import { MenuAcciones, Segmentado } from './components/tareas/Controles'
import UnidadTareas from './components/tareas/UnidadTareas'
import ImportarTareasDialog from './components/tareas/ImportarTareasDialog'
import useAccionesTarea from './components/tareas/useAccionesTarea'

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function porFechaLimite(a, b) {
  const fecha = (t) => (t.tieneFechaLimite && t.fechaLimite ? new Date(t.fechaLimite).getTime() : Infinity)
  return fecha(a) - fecha(b) || a.id - b.id
}

const CONECTORES = new Set(['y', 'e', 'de', 'del', 'la', 'el', 'los', 'las', 'para', 'en', 'con', 'a', 'al'])

/** «Software Libre y Herramientas para Cómputo» → «Software Libre». El nombre completo queda en el h2. */
function nombreCorto(nombre) {
  if (nombre.length <= 24) return nombre
  const palabras = []
  for (const palabra of nombre.split(/\s+/)) {
    if ([...palabras, palabra].join(' ').length > 22) break
    palabras.push(palabra)
  }
  while (palabras.length > 1 && CONECTORES.has(palabras.at(-1).toLowerCase())) palabras.pop()
  return palabras.length ? palabras.join(' ') : nombre
}

function porCalificarDe(tareas) {
  return tareas.filter((t) => t.estado !== 'BORRADOR').reduce((suma, t) => suma + conteoTarea(t).porCalificar, 0)
}

/**
 * Tareas del docente organizadas como la materia misma: una secuencia de
 * unidades, cada una con sus tareas, lo que falta calificar y su cierre.
 */
export default function TareasDocente() {
  const navigate = useNavigate()
  const rol = useAuthStore((state) => state.user?.rol)
  const tareas = useTareaStore((state) => state.tareas)
  const errorTareas = useTareaStore((state) => state.error)
  const obtenerDocente = useTareaStore((state) => state.obtenerDocente)
  const [materias, setMaterias] = useState(null)
  const [errorMaterias, setErrorMaterias] = useState('')
  const [tareasCargadas, setTareasCargadas] = useState(false)
  const [params, setParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [procesando, setProcesando] = useState(null)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const pestanasRef = useRef([])

  const cargarMaterias = useCallback(() => api.get('/materias/mis-materias')
    .then((res) => {
      setMaterias(res.data || [])
      setErrorMaterias('')
    })
    .catch((error) => {
      setMaterias((actuales) => actuales ?? [])
      setErrorMaterias(taskError(error, 'No se pudieron cargar tus materias. Recarga la página.'))
    }), [])

  const cargarTareas = useCallback(() => obtenerDocente({})
    .catch(() => {})
    .finally(() => setTareasCargadas(true)), [obtenerDocente])

  useEffect(() => {
    cargarMaterias()
    cargarTareas()
  }, [cargarMaterias, cargarTareas])

  // ADMIN ve todas las materias del plantel: solo se listan las que tienen tareas.
  const pestanas = useMemo(() => {
    const lista = materias ?? []
    return rol === 'ADMIN' ? lista.filter((m) => tareas.some((t) => t.materiaId === m.id)) : lista
  }, [materias, tareas, rol])

  const nombresCortos = useMemo(() => {
    const cortos = pestanas.map((m) => nombreCorto(m.nombre))
    // Si dos materias quedan con el mismo nombre corto, esas muestran el nombre completo.
    return Object.fromEntries(pestanas.map((m, i) => [m.id, cortos.filter((c) => c === cortos[i]).length > 1 ? m.nombre : cortos[i]]))
  }, [pestanas])
  const materia = pestanas.find((m) => m.id === Number(params.get('materia'))) ?? pestanas[0] ?? null
  const grupos = materia?.grupos ?? []
  const tareasMateria = useMemo(() => tareas.filter((t) => t.materiaId === materia?.id), [tareas, materia])
  const grupo = grupos.find((g) => g.id === Number(params.get('grupo')))
    ?? [...grupos].sort((a, b) => tareasMateria.filter((t) => t.grupoId === b.id).length - tareasMateria.filter((t) => t.grupoId === a.id).length)[0]
    ?? null
  const visibles = tareasMateria.filter((t) => !grupo || !t.grupoId || t.grupoId === grupo.id)
  const alumnosGrupo = visibles.find((t) => t.totalAlumnos)?.totalAlumnos

  const totalPendientes = porCalificarDe(tareas)
  const presencialesHoy = tareas.filter((t) => t.tipoEntrega === 'PRESENCIAL' && t.estado === 'PUBLICADA' && plazoTarea(t).dias === 0)

  const needle = normalizar(busqueda)
  const unidades = [...(materia?.unidades ?? [])].sort((a, b) => a.orden - b.orden)
  const idsUnidad = new Set(unidades.map((u) => u.id))
  const bloques = [
    ...unidades.map((unidad) => ({ unidad, tareas: visibles.filter((t) => t.unidadId === unidad.id) })),
    { unidad: null, tareas: visibles.filter((t) => !t.unidadId || !idsUnidad.has(t.unidadId)) },
  ]
    .filter((bloque) => bloque.unidad || bloque.tareas.length)
    .map((bloque) => ({ ...bloque, tareas: bloque.tareas.filter((t) => !needle || normalizar(t.titulo).includes(needle)).sort(porFechaLimite) }))
    .filter((bloque) => !needle || bloque.tareas.length)

  const elegir = (cambios) => setParams((actual) => {
    const siguiente = new URLSearchParams(actual)
    Object.entries(cambios).forEach(([clave, valor]) => (valor == null ? siguiente.delete(clave) : siguiente.set(clave, String(valor))))
    return siguiente
  }, { replace: true })

  const onTeclaPestana = (event, indice) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!paso) return
    event.preventDefault()
    const siguiente = (indice + paso + pestanas.length) % pestanas.length
    elegir({ materia: pestanas[siguiente].id, grupo: null })
    pestanasRef.current[siguiente]?.focus()
  }

  const onCambio = useCallback(() => { cargarTareas() }, [cargarTareas])
  const menuTarea = useAccionesTarea({ onCambio })

  const publicar = async (tarea) => {
    if (procesando) return
    setProcesando(`tarea-${tarea.id}`)
    try {
      await useTareaStore.getState().publicar(tarea.id)
      await cargarTareas()
      notify(`Publicaste «${tarea.titulo}». El grupo ya puede verla.`, 'success')
    } catch (error) {
      notify(taskError(error))
    } finally {
      setProcesando(null)
    }
  }

  const crearBorrador = async (unidad, datos) => {
    const store = useTareaStore.getState()
    try {
      const creada = await store.crear({
        titulo: datos.titulo,
        instrucciones: datos.instrucciones,
        materiaId: materia.id,
        grupoId: grupo.id,
        unidadId: unidad?.id,
        tipoEntrega: datos.tipoEntrega,
        tipoEvaluacion: 'DIRECTA',
        permiteReenvio: false,
        tieneFechaLimite: Boolean(datos.fechaLimite),
        fechaLimite: datos.fechaLimite ? `${datos.fechaLimite}T23:59` : undefined,
        horaLimite: datos.fechaLimite ? '23:59' : undefined,
        estado: 'BORRADOR',
        rubricJson: '',
      }, [])
      await cargarTareas()
      notify(`Guardaste «${datos.titulo}» como borrador${unidad ? ` en la Unidad ${unidad.orden}` : ''}.`, 'success', {
        action: { label: 'Completar', onClick: () => navigate(`/docente/tareas/crear?editarId=${creada.id}`) },
      })
    } finally {
      // El formulario rápido muestra su propio error; no debe verse como error del listado.
      store.clearError()
    }
  }

  const cerrarUnidad = async (unidad, faltan) => {
    if (procesando) return
    const finalizada = unidad.status === 'FINALIZADA'
    if (!finalizada && !(await confirmAction({
      title: `Cerrar la Unidad ${unidad.orden}`,
      description: `La unidad quedará finalizada y se descargará el cierre con calificaciones y evidencias.${faltan.length ? ` Todavía hay ${faltan.join(' y ')}.` : ''}`,
      confirmLabel: 'Cerrar y descargar',
    }))) return
    setProcesando(`unidad-${unidad.id}`)
    try {
      if (!finalizada) await api.patch(`/unidades/${unidad.id}/finalizar`)
      await useTareaStore.getState().descargarCierreUnidad(unidad.id)
      if (!finalizada) await Promise.all([cargarMaterias(), cargarTareas()])
      notify(finalizada ? `Se descargó el cierre de la Unidad ${unidad.orden}.` : `Cerraste la Unidad ${unidad.orden} y se descargó su cierre.`, 'success')
    } catch (error) {
      notify(taskError(error, 'No se pudo completar el cierre o la descarga. Actualiza la página para revisar el estado de la unidad.'))
      cargarMaterias()
    } finally {
      setProcesando(null)
    }
  }

  const onImportadas = async ({ creadas, adjuntosOmitidos }) => {
    setImportarAbierto(false)
    await cargarTareas()
    const n = creadas.length
    notify(`Importaste ${n} ${n === 1 ? 'tarea' : 'tareas'} en borrador a ${grupo.nombre}.${adjuntosOmitidos
      ? ` ${adjuntosOmitidos} ${adjuntosOmitidos === 1 ? 'adjunto ya no existía y no se copió' : 'adjuntos ya no existían y no se copiaron'}.`
      : ''}`, 'success')
  }

  const reporte = async (formato, filtros) => {
    try {
      await useTareaStore.getState().exportarReporte(filtros, formato)
      notify('Se descargó el reporte.', 'success')
    } catch (error) {
      notify(taskError(error, 'No se pudo descargar el reporte. Intenta de nuevo.'))
    }
  }

  const cargando = materias === null || !tareasCargadas
  const nombreGrupo = grupo ? ` · ${grupo.nombre}` : ''
  const nuevaTarea = `/docente/tareas/crear${materia ? `?materiaId=${materia.id}${grupo ? `&grupoId=${grupo.id}` : ''}` : ''}`

  let contenido
  if (cargando) {
    contenido = (
      <div role="status" aria-label="Cargando tareas" className="mt-6 space-y-3">
        <Skeleton className="h-11 w-full max-w-lg rounded-[12px]" />
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  } else if (errorTareas && !tareas.length) {
    contenido = <div className="mt-6"><TaskNotice error={errorTareas} onRetry={() => cargarTareas()} /></div>
  } else if (!pestanas.length) {
    contenido = (
      <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">{rol === 'ADMIN' ? 'Todavía no hay tareas registradas.' : 'Aún no tienes materias asignadas.'}</p>
        <p className="mt-1 text-sm text-muted-foreground">Cuando haya materias con grupo, sus unidades y tareas aparecerán aquí.</p>
      </div>
    )
  } else {
    contenido = (
      <>
        <div role="tablist" aria-label="Materias" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {pestanas.map((m, indice) => {
            const activa = m.id === materia.id
            const pendientes = porCalificarDe(tareas.filter((t) => t.materiaId === m.id))
            const unGrupo = m.grupos?.length === 1 ? m.grupos[0].nombre : null
            return (
              <button key={m.id} id={`pestana-materia-${m.id}`} ref={(el) => { pestanasRef.current[indice] = el }} type="button" role="tab"
                aria-selected={activa} aria-controls="panel-materia" tabIndex={activa ? 0 : -1} title={m.nombre}
                onClick={() => elegir({ materia: m.id, grupo: null })} onKeyDown={(event) => onTeclaPestana(event, indice)}
                className={cn('relative -mb-px flex h-11 max-w-[20rem] shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-150',
                  activa ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <span className="truncate">{nombresCortos[m.id]}</span>
                {unGrupo && <span className="shrink-0 text-muted-foreground">· {unGrupo}</span>}
                {pendientes > 0 && (
                  <span className="shrink-0 rounded-full bg-warning/20 px-1.5 text-xs font-semibold tabular-nums text-warning-foreground">
                    {pendientes}<span className="sr-only"> por calificar</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <section id="panel-materia" role="tabpanel" aria-labelledby={`pestana-materia-${materia.id}`} className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{materia.nombre}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {grupo ? `Grupo ${grupo.nombre}` : 'Sin grupo asignado'}
                {grupo?.modalidad && ` · ${grupo.modalidad === 'MIXTO' ? 'Mixto' : 'Escolarizado'}`}
                {alumnosGrupo ? ` · ${alumnosGrupo} alumnos` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {grupos.length > 1 && (
                <Segmentado label="Grupo" value={grupo?.id} onChange={(id) => elegir({ grupo: id })}
                  options={grupos.map((g) => ({ value: g.id, label: g.nombre }))} />
              )}
              {grupo && visibles.length > 0 && (
                <button type="button" onClick={() => setImportarAbierto(true)}
                  className={cn(buttonVariants({ variant: 'outline' }), 'h-9 gap-2 px-3')}>
                  <CopyPlus className="size-4" aria-hidden="true" />Importar tareas
                </button>
              )}
              <label className="relative">
                <span className="sr-only">Buscar tarea en {materia.nombre}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar tarea"
                  className="h-9 w-56 max-w-full rounded-[10px] border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
              </label>
            </div>
          </div>

          {errorMaterias && <div className="mt-4"><TaskNotice error={errorMaterias} onRetry={() => cargarMaterias()} /></div>}

          {grupo && !visibles.length && !needle && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-border px-5 py-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{grupo.nombre} todavía no tiene tareas.</span>{' '}
                Si ya diste {materia.nombre} en otro grupo, puedes traer esas tareas en vez de crearlas de nuevo.
              </p>
              <button type="button" onClick={() => setImportarAbierto(true)} className={cn(buttonVariants(), 'h-9 gap-2 px-3')}>
                <CopyPlus className="size-4" aria-hidden="true" />Importar tareas
              </button>
            </div>
          )}

          {bloques.length ? (
            <ol className="mt-5 space-y-3">
              {bloques.map((bloque, indice) => (
                <UnidadTareas key={bloque.unidad?.id ?? 'sin-unidad'} unidad={bloque.unidad} tareas={bloque.tareas}
                  ultimo={indice === bloques.length - 1} forzarAbierta={Boolean(needle)} puedeCrear={Boolean(grupo)}
                  formularioCompleto={`${nuevaTarea}${bloque.unidad ? `${nuevaTarea.includes('?') ? '&' : '?'}unidadId=${bloque.unidad.id}` : ''}`}
                  procesando={procesando} menuTarea={menuTarea} onPublicar={publicar} onCrearBorrador={crearBorrador}
                  onCerrarUnidad={cerrarUnidad} onReporte={reporte} />
              ))}
            </ol>
          ) : (
            <div className="mt-5 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">{needle ? 'Ninguna tarea coincide con la búsqueda.' : 'Esta materia todavía no tiene unidades ni tareas.'}</p>
              {!needle && <p className="mt-1 text-sm text-muted-foreground">Crea la primera con «Nueva tarea».</p>}
            </div>
          )}
        </section>
      </>
    )
  }

  return (
    <div className="mx-auto max-w-[76rem]">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Tareas</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {cargando ? 'Revisando tus entregas…' : totalPendientes
              ? <><span className="font-medium text-foreground tabular-nums">{totalPendientes}</span> {totalPendientes === 1 ? 'entrega por calificar' : 'entregas por calificar'}</>
              : 'Nada por calificar por ahora'}
            {!cargando && presencialesHoy.length > 0 && <> · {presencialesHoy.length} {presencialesHoy.length === 1 ? 'entrega presencial' : 'entregas presenciales'} hoy</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {materia && (
            <MenuAcciones label="Descargar reporte de tareas" align="end"
              className="h-9 w-auto gap-2 border border-border bg-background px-3 text-sm font-medium text-foreground"
              trigger={<><FolderDown className="size-4" aria-hidden="true" />Reporte</>}
              items={[
                { label: `Excel · ${materia.nombre}${nombreGrupo}`, icon: FileSpreadsheet, onSelect: () => reporte('excel', { materiaId: materia.id, grupoId: grupo?.id }) },
                { label: `PDF · ${materia.nombre}${nombreGrupo}`, icon: FileDown, onSelect: () => reporte('pdf', { materiaId: materia.id, grupoId: grupo?.id }) },
              ]} />
          )}
          <Link to={nuevaTarea} className={cn(buttonVariants(), 'h-9 px-3')}><Plus aria-hidden="true" />Nueva tarea</Link>
        </div>
      </header>
      {contenido}
      {importarAbierto && materia && grupo && (
        <ImportarTareasDialog open onClose={() => setImportarAbierto(false)} materia={materia} grupo={grupo} onImportadas={onImportadas} />
      )}
    </div>
  )
}
