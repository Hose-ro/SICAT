import { useEffect, useMemo, useState } from 'react'
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

const TASK_STATE_LABEL = {
  BORRADOR: 'Borrador',
  PUBLICADA: 'Publicada',
  VENCIDA: 'Vencida',
  CERRADA: 'Cerrada',
}

const TASK_STATE_CLASS = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  PUBLICADA: 'bg-emerald-100 text-emerald-700',
  VENCIDA: 'bg-amber-100 text-amber-700',
  CERRADA: 'bg-rose-100 text-rose-700',
}

const DELIVERY_STATE_LABEL = {
  PENDIENTE: 'Pendiente',
  ENTREGADA: 'Entregada',
  REVISADA: 'Revisada',
  INCORRECTA: 'Incorrecta',
  CALIFICADA: 'Calificada',
  NO_ENTREGADA: 'No entregada',
}

const DELIVERY_STATE_CLASS = {
  PENDIENTE: 'bg-slate-100 text-slate-700',
  ENTREGADA: 'bg-sky-100 text-sky-700',
  REVISADA: 'bg-violet-100 text-violet-700',
  INCORRECTA: 'bg-rose-100 text-rose-700',
  CALIFICADA: 'bg-emerald-100 text-emerald-700',
  NO_ENTREGADA: 'bg-amber-100 text-amber-700',
}

const TASK_TYPE_LABEL = {
  EN_LINEA: 'Entrega con archivo',
  PRESENCIAL: 'Presencial',
  FIRMA: 'Foto de firma',
  REVISION_EN_LINEA: 'Revisión en línea',
}

function formatDate(date) {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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

function SummaryCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="flex min-w-[10rem] flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {children}
      </select>
    </label>
  )
}

function DocenteTareasModule() {
  const { tareas, taskStats, loading, obtenerDocente, publicar, cerrar, reabrir, exportarTarea, descargarCierreUnidad } = useTareaStore()
  const [materias, setMaterias] = useState([])
  const [filters, setFilters] = useState({
    materiaId: '',
    grupoId: '',
    unidadId: '',
    estado: '',
    fecha: '',
  })
  const [busyId, setBusyId] = useState(null)
  const [closingUnit, setClosingUnit] = useState(false)

  useEffect(() => {
    api.get('/materias/mis-materias')
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]))
  }, [])

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

  const handleStateAction = async (task) => {
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
    } finally {
      setBusyId(null)
    }
  }

  const handleCloseUnit = async () => {
    if (!selectedUnit) return
    setClosingUnit(true)
    try {
      if (selectedUnit.status !== 'FINALIZADA') {
        await api.patch(`/unidades/${selectedUnit.id}/finalizar`)
      }
      await descargarCierreUnidad(selectedUnit.id)
      const materiasRes = await api.get('/materias/mis-materias')
      setMaterias(materiasRes.data || [])
      await obtenerDocente({
        materiaId: filters.materiaId || undefined,
        grupoId: filters.grupoId || undefined,
        unidadId: filters.unidadId || undefined,
        estado: filters.estado || undefined,
        fecha: filters.fecha || undefined,
      })
    } finally {
      setClosingUnit(false)
    }
  }

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
              <button
                type="button"
                onClick={handleCloseUnit}
                disabled={closingUnit}
                className="task-hero-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" />
                {closingUnit
                  ? 'Procesando unidad...'
                  : selectedUnit.status === 'FINALIZADA'
                    ? 'Descargar cierre de unidad'
                    : 'Cerrar unidad y descargar'}
              </button>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Layers3} label="Tareas activas" value={taskStats?.tareasActivas ?? 0} tone="blue" />
        <SummaryCard icon={Clock3} label="Pendientes de revisar" value={taskStats?.pendientesRevision ?? 0} tone="amber" />
        <SummaryCard icon={CalendarDays} label="Vencidas" value={taskStats?.vencidas ?? 0} tone="slate" />
        <SummaryCard icon={Send} label="Entregas tardías" value={taskStats?.entregasTardias ?? 0} tone="green" />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700">
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
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fecha</span>
            <input
              type="date"
              value={filters.fecha}
              onChange={(event) => setFilters((prev) => ({ ...prev, fecha: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400"
            />
          </label>

          <button
            type="button"
            onClick={() => setFilters({ materiaId: '', grupoId: '', unidadId: '', estado: '', fecha: '' })}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Limpiar
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lista de tareas</h2>
            <p className="text-sm text-slate-500">Cards operativas con estado, avance de entrega y acciones rápidas.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => useTareaStore.getState().exportarReporte({
                materiaId: filters.materiaId || undefined,
                grupoId: filters.grupoId || undefined,
                unidadId: filters.unidadId || undefined,
                estado: filters.estado || undefined,
                fecha: filters.fecha || undefined,
              }, 'excel')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => useTareaStore.getState().exportarReporte({
                materiaId: filters.materiaId || undefined,
                grupoId: filters.grupoId || undefined,
                unidadId: filters.unidadId || undefined,
                estado: filters.estado || undefined,
                fecha: filters.fecha || undefined,
              }, 'pdf')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
            Cargando tareas...
          </div>
        ) : tareas.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
            No hay tareas con los filtros actuales.
          </div>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-2">
            {tareas.map((task) => (
              <article key={task.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TASK_STATE_CLASS[task.estado] || 'bg-slate-100 text-slate-700'}`}>
                        {TASK_STATE_LABEL[task.estado] || task.estado}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {TASK_TYPE_LABEL[task.tipoEntrega] || task.tipoEntrega}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{task.titulo}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {task.materia?.nombre} · {task.grupo?.nombre || 'Sin grupo'} · {task.unidadRef?.nombre || 'Sin unidad'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><span className="font-semibold text-slate-800">Publicación:</span> {task.fechaPublicacion ? formatDateTime(task.fechaPublicacion) : 'Pendiente'}</p>
                      <p><span className="font-semibold text-slate-800">Límite:</span> {task.tieneFechaLimite ? formatDateTime(task.fechaLimite) : 'Sin límite'}</p>
                      <p><span className="font-semibold text-slate-800">Evaluación:</span> {task.tipoEvaluacion === 'RUBRICA' ? 'Rúbrica' : 'Directa'}</p>
                      <p><span className="font-semibold text-slate-800">Reenvío:</span> {task.permiteReenvio ? 'Permitido' : 'No permitido'}</p>
                    </div>
                  </div>

                  <div className="min-w-[14rem] rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Entrega</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{task.porcentajeEntrega}%</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Tardías</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{task.entregasTardias}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Revisión</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{task.pendientesRevision}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Promedio</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{task.promedio ?? '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-white px-3 py-1">{task.entregadas}/{task.totalAlumnos} entregadas</span>
                    <span className="rounded-full bg-white px-3 py-1">{task.noEntregadas} sin entregar</span>
                    <span className="rounded-full bg-white px-3 py-1">{task.calificadas} calificadas</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/docente/tareas/${task.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Users className="h-4 w-4" />
                      Ver entregas
                    </Link>
                    <Link
                      to={`/docente/tareas/crear?editarId=${task.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <PenSquare className="h-4 w-4" />
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleStateAction(task)}
                      disabled={busyId === task.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {busyId === task.id
                        ? 'Procesando...'
                        : task.estado === 'BORRADOR'
                          ? 'Publicar'
                          : task.estado === 'CERRADA'
                            ? 'Reabrir'
                            : 'Cerrar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportarTarea(task.id, 'pdf')}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportarTarea(task.id, 'excel')}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Excel
                    </button>
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
  const { studentTasks, loading, obtenerMisTareas } = useTareaStore()
  const [materias, setMaterias] = useState([])
  const [filters, setFilters] = useState({ materiaId: '', estado: '' })

  useEffect(() => {
    api.get('/materias/para-alumno')
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]))
  }, [])

  useEffect(() => {
    obtenerMisTareas(filters.materiaId ? Number(filters.materiaId) : undefined).catch(() => {})
  }, [filters.materiaId, obtenerMisTareas])

  const filteredTasks = useMemo(() => {
    if (!filters.estado) return studentTasks
    return studentTasks.filter((item) => item.estadoAlumno === filters.estado)
  }, [studentTasks, filters.estado])

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Clock3} label="Pendientes" value={stats.pendientes} tone="amber" />
        <SummaryCard icon={Send} label="Entregadas" value={stats.entregadas} tone="blue" />
        <SummaryCard icon={CalendarDays} label="Tardías" value={stats.tardias} tone="slate" />
        <SummaryCard icon={CheckCircle2} label="Calificadas" value={stats.calificadas} tone="green" />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
            <option value="ENTREGADA">Entregadas</option>
            <option value="REVISADA">Revisadas</option>
            <option value="CALIFICADA">Calificadas</option>
            <option value="INCORRECTA">Incorrectas</option>
            <option value="NO_ENTREGADA">No entregadas</option>
          </SelectField>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Tus tareas</h2>
          <p className="text-sm text-slate-500">Cada card muestra límite, estado, observaciones y calificación.</p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
            Cargando tareas...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
            No hay tareas con los filtros actuales.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredTasks.map(({ tarea, miEntrega, estadoAlumno, puedeEditarEntrega }) => (
              <article key={tarea.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${DELIVERY_STATE_CLASS[estadoAlumno] || 'bg-slate-100 text-slate-700'}`}>
                        {DELIVERY_STATE_LABEL[estadoAlumno] || estadoAlumno}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {TASK_TYPE_LABEL[tarea.tipoEntrega] || tarea.tipoEntrega}
                      </span>
                      {miEntrega?.fueTardia && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Entrega tardía
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{tarea.titulo}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {tarea.materia?.nombre} · {tarea.grupo?.nombre || 'Grupo'} · {tarea.unidadRef?.nombre || 'Sin unidad'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><span className="font-semibold text-slate-800">Fecha límite:</span> {tarea.tieneFechaLimite ? formatDateTime(tarea.fechaLimite) : 'Sin límite'}</p>
                      <p><span className="font-semibold text-slate-800">Entrega:</span> {miEntrega?.fechaEntrega ? formatDateTime(miEntrega.fechaEntrega) : 'Aún sin entrega'}</p>
                    </div>
                    {(miEntrega?.observacion || tarea.miEntrega?.observacion) && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Observación docente</p>
                        <p className="mt-2">{miEntrega?.observacion || tarea.miEntrega?.observacion}</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Calificación</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {typeof miEntrega?.calificacion === 'number'
                        ? miEntrega.calificacion
                        : miEntrega?.calificacionTipo || 'Pendiente'}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      {puedeEditarEntrega ? 'Puedes editar o reenviar esta entrega.' : 'La entrega ya no admite cambios.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    to={`/alumno/tareas/${tarea.id}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Ver detalle
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
  const role = user?.rol || user?.user_metadata?.custom_claims?.rol

  return role === 'ALUMNO'
    ? <AlumnoTareasModule />
    : <DocenteTareasModule />
}
