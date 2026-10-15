import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { useTareaStore } from '../store/tareaStore'

import TaskNotice from '../components/TaskNotice'
import TareasDocente from './docente/TareasDocente'
import { TASK_TYPE_LABEL, etiquetaEstadoAlumno, searchTasks, taskError, deliveryHelp, tipoActividad } from '../lib/tareas'

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

const CAMPO = 'h-10 w-full rounded-[10px] border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-sm'

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 sm:w-52">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select value={value} onChange={onChange} className={CAMPO}>{children}</select>
    </label>
  )
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

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
    // Lo que se aplica en clase no queda "pendiente" de entregar para el alumno.
    pendientes: studentTasks.filter((item) => (item.estadoAlumno === 'PENDIENTE' || item.estadoAlumno === 'NO_ENTREGADA') && item.tarea?.tipoEntrega !== 'PRESENCIAL').length,
    entregadas: studentTasks.filter((item) => ['ENTREGADA', 'REVISADA', 'CALIFICADA', 'INCORRECTA'].includes(item.estadoAlumno)).length,
    tardias: studentTasks.filter((item) => item.miEntrega?.fueTardia).length,
    calificadas: studentTasks.filter((item) => item.estadoAlumno === 'CALIFICADA').length,
  }), [studentTasks])
  const hayFiltros = Boolean(filters.materiaId || filters.estado || query)

  return (
    <div className="mx-auto max-w-[76rem] space-y-6">
      <header>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Mis tareas</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {loading && !studentTasks.length ? 'Revisando tus tareas…' : (
            <>
              <span className={stats.pendientes ? 'font-medium text-foreground' : ''}>{plural(stats.pendientes, 'por entregar', 'por entregar')}</span>
              {' · '}{plural(stats.entregadas, 'entregada', 'entregadas')}
              {stats.tardias > 0 && ` · ${plural(stats.tardias, 'tardía', 'tardías')}`}
              {' · '}{plural(stats.calificadas, 'calificada', 'calificadas')}
            </>
          )}
        </p>
      </header>

      <TaskNotice error={catalogError} />

      <section aria-label="Filtros" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-1 flex-col gap-1 sm:min-w-[16rem]">
          <span className="text-sm font-medium text-foreground">Buscar</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, materia o unidad" className={CAMPO} />
        </label>
        <SelectField label="Materia" value={filters.materiaId} onChange={(event) => setFilters((prev) => ({ ...prev, materiaId: event.target.value }))}>
          <option value="">Todas las materias</option>
          {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}</option>)}
        </SelectField>
        <SelectField label="Estado" value={filters.estado} onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}>
          <option value="">Todos</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="ENTREGADA">Por revisar por el docente</option>
          <option value="REVISADA">Revisadas</option>
          <option value="CALIFICADA">Calificadas</option>
          <option value="INCORRECTA">Requieren atención</option>
          <option value="NO_ENTREGADA">No entregadas</option>
        </SelectField>
        <SelectField label="Ordenar por" value={order} onChange={(event) => setOrder(event.target.value)}>
          <option value="deadline">Fecha límite más cercana</option>
          <option value="title">Título: A a Z</option>
        </SelectField>
      </section>

      <div className="flex min-h-9 items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">{plural(filteredTasks.length, 'tarea', 'tareas')}{hayFiltros ? ' con estos filtros' : ''}</span>
        {hayFiltros && (
          <Button variant="ghost" type="button" className="h-8 px-2" onClick={() => { setFilters({ materiaId: '', estado: '' }); setQuery('') }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <div role="status" className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Cargando tareas…
        </div>
      ) : error ? <TaskNotice error={error} onRetry={() => obtenerMisTareas(filters.materiaId || undefined).catch(() => {})} /> : filteredTasks.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          {hayFiltros ? 'Ninguna tarea coincide con los filtros.' : 'Todavía no tienes tareas.'}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
          {filteredTasks.map(({ tarea, miEntrega, estadoAlumno, puedeEditarEntrega }) => {
            const calificacion = typeof miEntrega?.calificacion === 'number' ? miEntrega.calificacion : miEntrega?.calificacionTipo
            const observacion = miEntrega?.observacion || tarea.miEntrega?.observacion
            const accion = tarea.tipoEntrega !== 'PRESENCIAL' && puedeEditarEntrega ? miEntrega ? 'Ver y actualizar entrega' : 'Entregar tarea' : 'Ver tarea'
            return (
              <li key={tarea.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DELIVERY_STATE_CLASS[estadoAlumno] || 'bg-muted text-foreground'}`}>
                      {etiquetaEstadoAlumno(estadoAlumno, tarea, Boolean(miEntrega))}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {tipoActividad(tarea).singular} · {TASK_TYPE_LABEL[tarea.tipoEntrega] || tarea.tipoEntrega}
                    </span>
                    {miEntrega?.fueTardia && (
                      <span className="rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">Entrega tardía</span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold leading-snug text-foreground">
                    <Link to={`/alumno/tareas/${tarea.id}`} className="underline-offset-4 hover:underline">{tarea.titulo}</Link>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {[tarea.materia?.nombre, tarea.grupo?.nombre, tarea.unidadRef?.nombre].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Fecha límite: <span className="text-foreground">{tarea.tieneFechaLimite ? formatDateTime(tarea.fechaLimite) : 'sin límite'}</span>
                    {miEntrega?.fechaEntrega && <> · Entregaste el <span className="text-foreground">{formatDateTime(miEntrega.fechaEntrega)}</span></>}
                  </p>
                  {observacion && (
                    <p className="rounded-[var(--radius-item)] bg-muted/60 px-3 py-2 text-sm text-foreground">
                      <span className="font-medium">Tu docente: </span>{observacion}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-col lg:items-end lg:text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Calificación</p>
                    <p className="text-xl font-semibold tabular-nums text-foreground">{calificacion ?? 'Sin calificar'}</p>
                    <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">{deliveryHelp(tarea, miEntrega, puedeEditarEntrega)}</p>
                  </div>
                  <Link to={`/alumno/tareas/${tarea.id}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    {accion}<ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Tareas() {
  const user = useAuthStore((state) => state.user)
  const role = user?.rol

  return role === 'ALUMNO'
    ? <AlumnoTareasModule />
    : <TareasDocente />
}
