import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileDown,
  Filter,
  Layers3,
  PenSquare,
  Plus,
  RefreshCcw,
  Send,
  Users,
} from 'lucide-react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { useTareaStore } from '../store/tareaStore'

import TaskNotice from '../components/TaskNotice'
import { TASK_STATE_LABEL, DELIVERY_STATE_LABEL, TASK_TYPE_LABEL, searchTasks, taskError, deliveryHelp } from '../lib/tareas'

const TASK_STATE_CLASS = {
  BORRADOR: 'bg-muted text-foreground',
  PUBLICADA: 'bg-success/10 text-foreground',
  VENCIDA: 'bg-warning/10 text-foreground',
  CERRADA: "bg-destructive/10 text-destructive-foreground",
}

const DELIVERY_STATE_CLASS = {
  PENDIENTE: 'bg-muted text-foreground',
  ENTREGADA: "bg-primary/10 text-primary-ink",
  REVISADA: "bg-primary/10 text-primary-ink",
  INCORRECTA: "bg-destructive/10 text-destructive-foreground",
  CALIFICADA: 'bg-success/10 text-foreground',
  NO_ENTREGADA: 'bg-warning/10 text-foreground',
}

function formatDateTime(date) {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SummaryCard({ icon, label, value, tone = 'blue' }) {
  const IconComponent = icon
  const tones = {
    blue: 'border-border bg-card text-foreground',
    green: 'border-success/30 bg-success/10 text-foreground',
    amber: 'border-warning/30 bg-warning/10 text-foreground',
    slate: 'border-border bg-muted/40 text-foreground',
  }

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-card p-3">
          <IconComponent className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="flex min-w-[10rem] flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/40"
      >
        {children}
      </select>
    </label>
  )
}

function TaskSearch({ query, setQuery, order, setOrder, docente = false }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row">
    <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Buscar tareas
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, materia, grupo o unidad" className="rounded-xl border border-input bg-background px-4 py-3 font-normal" />
    </label>
    <SelectField label="Ordenar por" value={order} onChange={(event) => setOrder(event.target.value)}>
      <option value="deadline">Fecha límite más cercana</option>
      <option value="title">Título: A a Z</option>
      {docente && <option value="review">Más entregas por revisar</option>}
    </SelectField>
  </div>
}

function DocenteTareasModule() {
  const { tareas, taskStats, loading, error, obtenerDocente, publicar, cerrar, reabrir, exportarTarea, descargarCierreUnidad } = useTareaStore()
  const [materias, setMaterias] = useState([])
  const [filters, setFilters] = useState({
    materiaId: '',
    grupoId: '',
    unidadId: '',
    estado: '',
    fecha: '',
  })
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('deadline')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const visibleTasks = useMemo(() => searchTasks(tareas, query, order), [tareas, query, order])
  const [busyId, setBusyId] = useState(null)
  const [closingUnit, setClosingUnit] = useState(false)

  const cargarMaterias = useCallback(() => {
    return api.get('/materias/mis-materias')
      .then((res) => setMaterias(res.data || []))
      .catch((error) => setActionError(taskError(error, 'No se pudieron cargar las materias. Recarga la página.')))
  }, [])

  useEffect(() => {
    cargarMaterias()
  }, [cargarMaterias])

  useEffect(() => {
    obtenerDocente({
      materiaId: filters.materiaId || undefined,
      grupoId: filters.grupoId || undefined,
      unidadId: filters.unidadId || undefined,
      estado: filters.estado || undefined,
      fecha: filters.fecha || undefined,
    }).catch(() => {})
  }, [filters, obtenerDocente])

  const selectedMateria = useMemo(
    () => materias.find((materia) => materia.id === Number(filters.materiaId)),
    [materias, filters.materiaId],
  )

  const availableGroups = selectedMateria?.grupos || []
  const availableUnits = selectedMateria?.unidades || []
  const selectedUnit = availableUnits.find((unit) => unit.id === Number(filters.unidadId))

  const download = async (callback) => {
    setActionError('')
    try { await callback() } catch (error) { setActionError(taskError(error, 'No se pudo descargar el archivo. Intenta de nuevo.')) }
  }

  const handleStateAction = async (task) => {
    if (busyId !== null) return
    setActionError('')
    setSuccess('')
    try {
      setBusyId(task.id)
      if (task.estado === 'BORRADOR') await publicar(task.id)
      else if (task.estado === 'CERRADA') await reabrir(task.id)
      else await cerrar(task.id)
      await obtenerDocente({
        materiaId: filters.materiaId || undefined,
        grupoId: filters.grupoId || undefined,
        unidadId: filters.unidadId || undefined,
        estado: filters.estado || undefined,
        fecha: filters.fecha || undefined,
      })
      setSuccess(`Se actualizó la tarea «${task.titulo}».`)
    } catch (error) {
      setActionError(taskError(error))
    } finally {
      setBusyId(null)
    }
  }

  const handleCloseUnit = useAsyncAction(async () => {
    if (!selectedUnit) return
    if (selectedUnit.status !== 'FINALIZADA' && !(await confirmAction(`Cerrar «${selectedUnit.nombre}» finalizará la unidad. ¿Deseas continuar?`))) return
    setActionError('')
    setClosingUnit(true)
    try {
      if (selectedUnit.status !== 'FINALIZADA') {
        await api.patch(`/unidades/${selectedUnit.id}/finalizar`)
      }
      await descargarCierreUnidad(selectedUnit.id)
      await cargarMaterias()
      await obtenerDocente({
        materiaId: filters.materiaId || undefined,
        grupoId: filters.grupoId || undefined,
        unidadId: filters.unidadId || undefined,
        estado: filters.estado || undefined,
        fecha: filters.fecha || undefined,
      })
      setSuccess('El cierre de unidad se descargó correctamente.')
    } catch (error) {
      setActionError(taskError(error, 'No se pudo completar el cierre o la descarga. Actualiza la página para consultar el estado de la unidad.'))
    } finally {
      setClosingUnit(false)
    }
  })

  return (
    <div className="space-y-6">
      <section className="task-hero px-6 py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="task-hero-chip inline-flex w-fit rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              Docente
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Tareas</h1>
              <p className="task-hero-subtitle mt-2 text-sm">
                Crea, publica, revisa, califica y exporta tareas
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {selectedUnit && (
              <Button variant="ghost"
                type="button"
                onClick={handleCloseUnit}
                disabled={closingUnit}
                className="task-hero-button inline-flex items-center justify-center gap-2  px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" />
                {closingUnit
                  ? 'Procesando unidad...'
                  : selectedUnit.status === 'FINALIZADA'
                    ? 'Descargar cierre de unidad'
                    : 'Cerrar unidad y descargar'}
              </Button>
            )}
            <Link
              to={`/docente/tareas/crear${filters.materiaId ? `?materiaId=${filters.materiaId}${filters.grupoId ? `&grupoId=${filters.grupoId}` : ''}${filters.unidadId ? `&unidadId=${filters.unidadId}` : ''}` : ''}`}
              className="task-hero-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Crear tarea
            </Link>
          </div>
        </div>
      </section>

      <TaskNotice error={actionError} success={success} />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard icon={Layers3} label="Tareas activas" value={taskStats?.tareasActivas ?? 0} tone="blue" />
        <SummaryCard icon={Clock3} label="Pendientes de revisar" value={taskStats?.pendientesRevision ?? 0} tone="amber" />
        <SummaryCard icon={CalendarDays} label="Vencidas" value={taskStats?.vencidas ?? 0} tone="slate" />
        <SummaryCard icon={Send} label="Entregas tardías" value={taskStats?.entregasTardias ?? 0} tone="green" />
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Filter className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Filtros</h2>
        </div>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:flex-wrap">
          <SelectField
            label="Materia"
            value={filters.materiaId}
            onChange={(event) => setFilters((prev) => ({
              ...prev,
              materiaId: event.target.value,
              grupoId: '',
              unidadId: '',
            }))}
          >
            <option value="">Todas las materias</option>
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>{materia.nombre}</option>
            ))}
          </SelectField>

          <SelectField
            label="Grupo"
            value={filters.grupoId}
            disabled={!selectedMateria}
            onChange={(event) => setFilters((prev) => ({ ...prev, grupoId: event.target.value }))}
          >
            <option value="">Todos los grupos</option>
            {availableGroups.map((grupo) => (
              <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
            ))}
          </SelectField>

          <SelectField
            label="Unidad"
            value={filters.unidadId}
            disabled={!selectedMateria}
            onChange={(event) => setFilters((prev) => ({ ...prev, unidadId: event.target.value }))}
          >
            <option value="">Todas las unidades</option>
            {availableUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.nombre}</option>
            ))}
          </SelectField>

          <SelectField
            label="Estado"
            value={filters.estado}
            onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="PUBLICADA">Publicada</option>
            <option value="VENCIDA">Vencida</option>
            <option value="CERRADA">Cerrada</option>
          </SelectField>

          <label className="flex min-w-[10rem] flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Publicación o límite</span>
            <input
              type="date"
              value={filters.fecha}
              onChange={(event) => setFilters((prev) => ({ ...prev, fecha: event.target.value }))}
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <Button variant="outline"
            type="button"
            onClick={() => { setFilters({ materiaId: '', grupoId: '', unidadId: '', estado: '', fecha: '' }); setQuery('') }}
            className="mt-auto inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold"
          >
            <RefreshCcw className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Lista de tareas</h2>
            <p className="text-sm text-muted-foreground">Publica los borradores y entra a Ver entregas para revisar o calificar el trabajo del grupo.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"
              type="button"
              onClick={() => download(() => useTareaStore.getState().exportarReporte({
                materiaId: filters.materiaId || undefined,
                grupoId: filters.grupoId || undefined,
                unidadId: filters.unidadId || undefined,
                estado: filters.estado || undefined,
                fecha: filters.fecha || undefined,
              }, 'excel'))}
              className="inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline"
              type="button"
              onClick={() => download(() => useTareaStore.getState().exportarReporte({
                materiaId: filters.materiaId || undefined,
                grupoId: filters.grupoId || undefined,
                unidadId: filters.unidadId || undefined,
                estado: filters.estado || undefined,
                fecha: filters.fecha || undefined,
              }, 'pdf'))}
              className="inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-semibold"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        <TaskSearch query={query} setQuery={setQuery} order={order} setOrder={setOrder} docente />
        <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">{visibleTasks.length} {visibleTasks.length === 1 ? 'tarea encontrada' : 'tareas encontradas'}. Los reportes usan los filtros de materia, grupo, unidad, estado y fecha.</p>
        {loading ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center text-sm text-muted-foreground">
            Cargando tareas...
          </div>
        ) : error ? <TaskNotice error={error} onRetry={() => obtenerDocente(filters).catch(() => {})} /> : visibleTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center text-sm text-muted-foreground">
            No hay tareas con los filtros actuales.
          </div>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-2">
            {visibleTasks.map((task) => (
              <article key={task.id} className="rounded-[1.75rem] border border-border bg-muted/40 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TASK_STATE_CLASS[task.estado] || 'bg-muted text-foreground'}`}>
                        {TASK_STATE_LABEL[task.estado] || task.estado}
                      </span>
                      <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {TASK_TYPE_LABEL[task.tipoEntrega] || task.tipoEntrega}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{task.titulo}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {task.materia?.nombre} · {task.grupo?.nombre || 'Sin grupo'} · {task.unidadRef?.nombre || 'Sin unidad'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p><span className="font-semibold text-foreground">Publicación:</span> {task.fechaPublicacion ? formatDateTime(task.fechaPublicacion) : 'Pendiente'}</p>
                      <p><span className="font-semibold text-foreground">Límite:</span> {task.tieneFechaLimite ? formatDateTime(task.fechaLimite) : 'Sin límite'}</p>
                      <p><span className="font-semibold text-foreground">Evaluación:</span> {task.tipoEvaluacion === 'RUBRICA' ? 'Rúbrica' : 'Directa'}</p>
                      <p><span className="font-semibold text-foreground">Reenvío:</span> {task.permiteReenvio ? 'Permitido' : 'No permitido'}</p>
                    </div>
                  </div>

                  <div className="min-w-[14rem] rounded-3xl border border-border bg-card p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Entrega</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{task.porcentajeEntrega}%</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tardías</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{task.entregasTardias}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Revisión</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{task.pendientesRevision}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Promedio</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{task.promedio ?? '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-card px-3 py-1">{task.entregadas}/{task.totalAlumnos} entregadas</span>
                    <span className="rounded-full bg-card px-3 py-1">{task.noEntregadas} sin entregar</span>
                    <span className="rounded-full bg-card px-3 py-1">{task.calificadas} calificadas</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/docente/tareas/${task.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary"
                    >
                      <Users className="h-4 w-4" />
                      Ver entregas
                    </Link>
                    <Link
                      to={`/docente/tareas/crear?editarId=${task.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40"
                    >
                      <PenSquare className="h-4 w-4" />
                      Editar
                    </Link>
                    <Button variant="outline"
                      type="button"
                      onClick={() => handleStateAction(task)}
                      disabled={busyId !== null}
                      className="border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {busyId === task.id
                        ? 'Procesando...'
                        : task.estado === 'BORRADOR'
                          ? 'Publicar'
                          : task.estado === 'CERRADA'
                            ? 'Reabrir'
                            : 'Cerrar'}
                    </Button>
                    <Button variant="outline"
                      type="button"
                      onClick={() => download(() => exportarTarea(task.id, 'pdf'))}
                      className="border px-4 py-2.5 text-sm font-semibold"
                    >
                      PDF
                    </Button>
                    <Button variant="outline"
                      type="button"
                      onClick={() => download(() => exportarTarea(task.id, 'excel'))}
                      className="border px-4 py-2.5 text-sm font-semibold"
                    >
                      Excel
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AlumnoTareasModule() {
  const { studentTasks, loading, error, obtenerMisTareas } = useTareaStore()
  const [materias, setMaterias] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [filters, setFilters] = useState({ materiaId: '', estado: '' })
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('deadline')

  useEffect(() => {
    api.get('/materias/para-alumno')
      .then((res) => setMaterias(res.data || []))
      .catch((error) => setCatalogError(taskError(error, 'No se pudieron cargar las materias. Recarga la página.')))
  }, [])

  useEffect(() => {
    obtenerMisTareas(filters.materiaId ? Number(filters.materiaId) : undefined).catch(() => {})
  }, [filters.materiaId, obtenerMisTareas])

  const filteredTasks = useMemo(() => {
    return searchTasks(studentTasks.filter((item) => !filters.estado || item.estadoAlumno === filters.estado), query, order)
  }, [studentTasks, filters.estado, query, order])

  const stats = useMemo(() => ({
    pendientes: studentTasks.filter((item) => item.estadoAlumno === 'PENDIENTE' || item.estadoAlumno === 'NO_ENTREGADA').length,
    entregadas: studentTasks.filter((item) => ['ENTREGADA', 'REVISADA', 'CALIFICADA', 'INCORRECTA'].includes(item.estadoAlumno)).length,
    tardias: studentTasks.filter((item) => item.miEntrega?.fueTardia).length,
    calificadas: studentTasks.filter((item) => item.estadoAlumno === 'CALIFICADA').length,
  }), [studentTasks])

  return (
    <div className="space-y-6">
      <section className="task-hero px-6 py-7">
        <div className="max-w-2xl space-y-3">
          <span className="task-hero-chip inline-flex w-fit rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
            Módulo alumno
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Mis tareas y entregas</h1>
          <p className="task-hero-subtitle text-sm">
            Revisa pendientes, sube varios archivos, consulta observaciones y vuelve a enviar cuando el docente lo permita.
          </p>
        </div>
      </section>

      <TaskNotice error={catalogError} />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard icon={Clock3} label="Pendientes" value={stats.pendientes} tone="amber" />
        <SummaryCard icon={Send} label="Entregadas" value={stats.entregadas} tone="blue" />
        <SummaryCard icon={CalendarDays} label="Tardías" value={stats.tardias} tone="slate" />
        <SummaryCard icon={CheckCircle2} label="Calificadas" value={stats.calificadas} tone="green" />
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row">
          <SelectField
            label="Materia"
            value={filters.materiaId}
            onChange={(event) => setFilters((prev) => ({ ...prev, materiaId: event.target.value }))}
          >
            <option value="">Todas las materias</option>
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>{materia.nombre}</option>
            ))}
          </SelectField>

          <SelectField
            label="Estado"
            value={filters.estado}
            onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
          >
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="ENTREGADA">Por revisar por el docente</option>
            <option value="REVISADA">Revisadas</option>
            <option value="CALIFICADA">Calificadas</option>
            <option value="INCORRECTA">Requieren atención</option>
            <option value="NO_ENTREGADA">No entregadas</option>
          </SelectField>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Tus tareas</h2>
          <p className="text-sm text-muted-foreground">Consulta qué debes entregar, las observaciones de tu docente y tu calificación.</p>
        </div>

        <TaskSearch query={query} setQuery={setQuery} order={order} setOrder={setOrder} />
        <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground"><span aria-live="polite">{filteredTasks.length} {filteredTasks.length === 1 ? 'tarea encontrada' : 'tareas encontradas'}</span><Button variant="ghost" type="button" onClick={() => { setFilters({ materiaId: '', estado: '' }); setQuery('') }} className="font-semibold underline">Limpiar filtros</Button></div>
        {loading ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center text-sm text-muted-foreground">
            Cargando tareas...
          </div>
        ) : error ? <TaskNotice error={error} onRetry={() => obtenerMisTareas(filters.materiaId || undefined).catch(() => {})} /> : filteredTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center text-sm text-muted-foreground">
            No hay tareas con los filtros actuales.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredTasks.map(({ tarea, miEntrega, estadoAlumno, puedeEditarEntrega }) => (
              <article key={tarea.id} className="rounded-[1.75rem] border border-border bg-muted/40 p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${DELIVERY_STATE_CLASS[estadoAlumno] || 'bg-muted text-foreground'}`}>
                        {DELIVERY_STATE_LABEL[estadoAlumno] || estadoAlumno}
                      </span>
                      <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {TASK_TYPE_LABEL[tarea.tipoEntrega] || tarea.tipoEntrega}
                      </span>
                      {miEntrega?.fueTardia && (
                        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-foreground">
                          Entrega tardía
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{tarea.titulo}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tarea.materia?.nombre} · {tarea.grupo?.nombre || 'Grupo'} · {tarea.unidadRef?.nombre || 'Sin unidad'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p><span className="font-semibold text-foreground">Fecha límite:</span> {tarea.tieneFechaLimite ? formatDateTime(tarea.fechaLimite) : 'Sin límite'}</p>
                      <p><span className="font-semibold text-foreground">Entrega:</span> {miEntrega?.fechaEntrega ? formatDateTime(miEntrega.fechaEntrega) : 'Aún sin entrega'}</p>
                    </div>
                    {(miEntrega?.observacion || tarea.miEntrega?.observacion) && (
                      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Observación docente</p>
                        <p className="mt-2">{miEntrega?.observacion || tarea.miEntrega?.observacion}</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Calificación</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {typeof miEntrega?.calificacion === 'number'
                        ? miEntrega.calificacion
                        : miEntrega?.calificacionTipo || 'Pendiente'}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {deliveryHelp(tarea, miEntrega, puedeEditarEntrega)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    to={`/alumno/tareas/${tarea.id}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary"
                  >
                    {tarea.tipoEntrega !== 'PRESENCIAL' && puedeEditarEntrega ? miEntrega ? 'Ver y actualizar entrega' : 'Entregar tarea' : 'Consultar tarea'}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function Tareas() {
  const user = useAuthStore((state) => state.user)
  const role = user?.rol

  return role === 'ALUMNO'
    ? <AlumnoTareasModule />
    : <DocenteTareasModule />
}
