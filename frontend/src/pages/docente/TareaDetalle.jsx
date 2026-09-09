import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileBadge2,
  MessageSquare,
  SquareCheckBig,
  Upload,
} from 'lucide-react'
import api from '../../api/axios'
import { useTareaStore } from '../../store/tareaStore'

import TaskCriteria from '../../components/TaskCriteria'
import TaskNotice from '../../components/TaskNotice'
import { TASK_STATE_LABEL, DELIVERY_STATE_LABEL, taskError } from '../../lib/tareas'

const STATE_CLASS = {
  PENDIENTE: 'bg-muted text-foreground',
  ENTREGADA: 'bg-primary/10 text-primary',
  REVISADA: 'bg-primary/10 text-primary',
  INCORRECTA: 'bg-destructive/10 text-destructive',
  CALIFICADA: 'bg-success/10 text-foreground',
  NO_ENTREGADA: 'bg-warning/10 text-foreground',
}

const CALIFICATION_TYPES = [
  { value: 'NUMERICA', label: 'Numérica' },
  { value: 'REVISADO', label: 'Revisado' },
  { value: 'FIRMA', label: 'Firma' },
]

function resolveApiUrl(url) {
  if (!url) return '#'
  return new URL(url, api.defaults.baseURL).toString()
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

export default function TareaDetalle() {
  const { id } = useParams()
  const tareaId = Number(id)
  const {
    tareaActiva,
    entregas,
    entregasStats,
    obtenerEntregas,
    revisar,
    revisarMasivo,
    calificar,
    marcarIncorrecta,
    devolverParaCorreccion,
    descargarEntregas,
    marcarPresencial,
    loading,
    error,
  } = useTareaStore()

  const [filters, setFilters] = useState({ estado: '', tardia: false, q: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [drafts, setDrafts] = useState({})
  const [running, setRunning] = useState(null)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(() => obtenerEntregas(tareaId, {
    estado: filters.estado || undefined,
    tardia: filters.tardia || undefined,
    q: filters.q || undefined,
  }), [tareaId, filters.estado, filters.tardia, filters.q, obtenerEntregas])

  useEffect(() => {
    const timer = setTimeout(() => { load().catch(() => {}) }, 250)
    return () => clearTimeout(timer)
  }, [load])

  const changeFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setSelectedIds([])
  }

  const selectedDeliveries = useMemo(
    () => entregas.filter((item) => !item.esSintetica && selectedIds.includes(item.id)),
    [entregas, selectedIds],
  )

  const updateDraft = (deliveryId, changes) => {
    const delivery = entregas.find((item) => item.id === deliveryId)
    setDrafts((prev) => ({
      ...prev,
      [deliveryId]: {
        observacion: prev[deliveryId]?.observacion ?? delivery?.observacion ?? '',
        calificacion: prev[deliveryId]?.calificacion ?? delivery?.calificacion ?? '',
        calificacionTipo: prev[deliveryId]?.calificacionTipo ?? delivery?.calificacionTipo ?? 'NUMERICA',
        ...changes,
      },
    }))
  }

  const perform = async (key, callback) => {
    if (running) return
    setActionError('')
    setSuccess('')
    setRunning(key)
    try {
      await callback()
      setSelectedIds([])
      await load()
      setSuccess(key === 'bulk-download' ? 'Se descargaron las entregas seleccionadas.' : 'Los cambios se guardaron correctamente.')
    } catch (error) {
      setActionError(taskError(error))
    } finally {
      setRunning(null)
    }
  }

  const requestCorrection = (delivery, draft) => {
    if (!draft.observacion.trim()) {
      setActionError('Escribe qué debe corregir el alumno en la observación.')
      return
    }
    return perform(`return-${delivery.id}`, () => devolverParaCorreccion(delivery.id, draft.observacion, true))
  }

  const saveGrade = (delivery, draft) => {
    const grade = Number(draft.calificacion)
    if (draft.calificacionTipo === 'NUMERICA' && (draft.calificacion === '' || !Number.isFinite(grade) || grade < 0 || grade > 100)) {
      setActionError('Ingresa una calificación entre 0 y 100.')
      return
    }
    return perform(`grade-${delivery.id}`, () => calificar(delivery.id, {
      observacion: draft.observacion,
      calificacion: draft.calificacionTipo === 'NUMERICA' ? grade : undefined,
      calificacionTipo: draft.calificacionTipo,
    }))
  }

  if ((!tareaActiva || tareaActiva.id !== tareaId) && !error) {
    return <div className="px-4 py-8 text-sm text-muted-foreground">Cargando revisión de entregas...</div>
  }

  if (!tareaActiva || tareaActiva.id !== tareaId) return <TaskNotice error={error || 'No se pudo cargar la tarea.'} onRetry={() => load().catch(() => {})} />

  return (
    <div className="space-y-6">
      <section className="task-hero px-6 py-7">
        <Link
          to="/tareas"
          className="task-hero-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al módulo
        </Link>

        {tareaActiva && (
          <div className="mt-5 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_CLASS[tareaActiva.estado] || 'task-hero-badge'}`}>
                  {TASK_STATE_LABEL[tareaActiva.estado] || tareaActiva.estado}
                </span>
                {tareaActiva.entregasTardias > 0 && (
                  <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-foreground">
                    {tareaActiva.entregasTardias} tardías
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{tareaActiva.titulo}</h1>
                <p className="task-hero-subtitle mt-2 max-w-3xl whitespace-pre-wrap text-sm">{tareaActiva.instrucciones}</p>
              </div>
              <div className="task-hero-meta grid gap-2 text-sm md:grid-cols-2">
                <p><span className="task-hero-emphasis font-semibold">Materia:</span> {tareaActiva.materia?.nombre}</p>
                <p><span className="task-hero-emphasis font-semibold">Grupo:</span> {tareaActiva.grupo?.nombre || 'Sin grupo'}</p>
                <p><span className="task-hero-emphasis font-semibold">Unidad:</span> {tareaActiva.unidadRef?.nombre || 'Sin unidad'}</p>
                <p><span className="task-hero-emphasis font-semibold">Límite:</span> {tareaActiva.tieneFechaLimite ? formatDateTime(tareaActiva.fechaLimite) : 'Sin límite'}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="task-hero-surface rounded-3xl p-4">
                <p className="task-hero-meta text-xs uppercase tracking-[0.16em]">Entrega</p>
                <p className="mt-2 text-3xl font-semibold">{tareaActiva.porcentajeEntrega}%</p>
                <p className="task-hero-meta mt-1 text-sm">{tareaActiva.entregadas}/{tareaActiva.totalAlumnos} entregadas</p>
              </div>
              <div className="task-hero-surface rounded-3xl p-4">
                <p className="task-hero-meta text-xs uppercase tracking-[0.16em]">Pendientes</p>
                <p className="mt-2 text-3xl font-semibold">{tareaActiva.pendientesRevision}</p>
                <p className="task-hero-meta mt-1 text-sm">Sin revisar o sin calificar</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <TaskCriteria tarea={tareaActiva} />
      <TaskNotice error={actionError || error} success={success} />
      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-4 xl:flex-row">
            <label className="flex min-w-[11rem] flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estado</span>
              <select
                value={filters.estado}
                onChange={(event) => changeFilters({ estado: event.target.value })}
                className="rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todas</option>
                <option value="PENDIENTES">Pendientes</option>
                <option value="REVISADA">Revisadas</option>
                <option value="INCORRECTA">Incorrectas</option>
                <option value="CALIFICADA">Calificadas</option>
                <option value="NO_ENTREGADAS">No entregadas</option>
              </select>
            </label>

            <label className="flex min-w-[11rem] flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Buscar alumno</span>
              <input
                type="search"
                value={filters.q}
                onChange={(event) => changeFilters({ q: event.target.value })}
                placeholder="Nombre o control"
                className="rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="mt-auto inline-flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={filters.tardia}
                onChange={(event) => changeFilters({ tardia: event.target.checked })}
              />
              Solo tardías
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedDeliveries.length === 0 || Boolean(running) || loading}
              onClick={() => perform('bulk-review', () => revisarMasivo(tareaId, selectedDeliveries.map((item) => item.id), undefined))}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-60"
            >
              <SquareCheckBig className="h-4 w-4" />
              Marcar como revisadas
            </button>
            <button
              type="button"
              disabled={selectedDeliveries.length === 0 || Boolean(running) || loading}
              onClick={() => perform('bulk-download', () => descargarEntregas(tareaId, selectedDeliveries.map((item) => item.id)))}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Descargar seleccionadas
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" disabled={Boolean(running) || loading || !entregas.some((item) => !item.esSintetica)} checked={entregas.some((item) => !item.esSintetica) && entregas.filter((item) => !item.esSintetica).every((item) => selectedIds.includes(item.id))} onChange={(event) => setSelectedIds(event.target.checked ? entregas.filter((item) => !item.esSintetica).map((item) => item.id) : [])} />
          Seleccionar todas las entregas visibles · {selectedDeliveries.length} seleccionadas
        </label>
        <p className="mt-3 text-sm text-muted-foreground">Marcar como revisada registra la revisión sin asignar una nota. Para solicitar otro envío, escribe una observación y usa Pedir corrección.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1">{entregasStats?.pendientes ?? 0} pendientes</span>
          <span className="rounded-full bg-muted px-3 py-1">{entregasStats?.revisadas ?? 0} revisadas</span>
          <span className="rounded-full bg-muted px-3 py-1">{entregasStats?.incorrectas ?? 0} incorrectas</span>
          <span className="rounded-full bg-muted px-3 py-1">{entregasStats?.tardias ?? 0} tardías</span>
          <span className="rounded-full bg-muted px-3 py-1">{entregasStats?.noEntregadas ?? 0} no entregadas</span>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center text-sm text-muted-foreground">
          Cargando entregas...
        </div>
      ) : entregas.length === 0 ? <p className="rounded-2xl border border-border p-8 text-center text-muted-foreground">No hay entregas con estos filtros. Prueba otro estado o nombre.</p> : (
        <section className="grid gap-4 2xl:grid-cols-2">
          {entregas.map((delivery) => {
            const draft = drafts[delivery.id] || {
              observacion: delivery.observacion || '',
              calificacion: delivery.calificacion ?? '',
              calificacionTipo: delivery.calificacionTipo || 'NUMERICA',
            }

            return (
              <article key={delivery.id} className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {!delivery.esSintetica && (
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar entrega de ${delivery.alumno.nombre}`}
                          disabled={Boolean(running) || loading}
                          checked={selectedIds.includes(delivery.id)}
                          onChange={() => setSelectedIds((prev) => prev.includes(delivery.id)
                            ? prev.filter((value) => value !== delivery.id)
                            : [...prev, delivery.id])}
                        />
                      )}
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_CLASS[delivery.estadoRevision] || 'bg-muted text-foreground'}`}>
                        {DELIVERY_STATE_LABEL[delivery.estadoRevision] || delivery.estadoRevision}
                      </span>
                      {delivery.fueTardia && (
                        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-foreground">
                          Tardía
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{delivery.alumno.nombre}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">No. control: {delivery.alumno.numeroControl || 'Sin registro'}</p>
                    </div>

                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p><span className="font-semibold text-foreground">Fecha:</span> {delivery.fechaEntrega ? formatDateTime(delivery.fechaEntrega) : 'Sin entrega'}</p>
                      <p><span className="font-semibold text-foreground">Versión:</span> {delivery.versionEntrega || 0}</p>
                    </div>

                    {delivery.comentarioAlumno && (
                      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        <div className="mb-2 flex items-center gap-2 text-foreground">
                          <MessageSquare className="h-4 w-4" />
                          <span className="font-semibold">Comentario del alumno</span>
                        </div>
                        <p>{delivery.comentarioAlumno}</p>
                      </div>
                    )}

                    {delivery.archivos?.length > 0 && (
                      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        <div className="mb-3 flex items-center gap-2 text-foreground">
                          <Upload className="h-4 w-4" />
                          <span className="font-semibold">Archivos enviados</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {delivery.archivos.map((file) => (
                            <a
                              key={file.id}
                              href={resolveApiUrl(file.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/40"
                            >
                              <FileBadge2 className="h-3.5 w-3.5" />
                              {file.nombre}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-md space-y-3 rounded-[1.5rem] border border-border bg-muted/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Calificación</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          disabled={Boolean(running) || draft.calificacionTipo !== 'NUMERICA' || delivery.esSintetica}
                          value={draft.calificacion}
                          onChange={(event) => updateDraft(delivery.id, { calificacion: event.target.value })}
                          className="rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipo</span>
                        <select
                          disabled={Boolean(running) || delivery.esSintetica}
                          value={draft.calificacionTipo}
                          onChange={(event) => updateDraft(delivery.id, { calificacionTipo: event.target.value })}
                          className="rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
                        >
                          {CALIFICATION_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Observación docente</span>
                      <textarea
                        rows={4}
                        disabled={Boolean(running) || delivery.esSintetica}
                        value={draft.observacion}
                        onChange={(event) => updateDraft(delivery.id, { observacion: event.target.value })}
                        className="rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
                      />
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {delivery.esSintetica ? (
                        tareaActiva?.tipoEntrega === 'PRESENCIAL' ? (
                          <button
                            type="button"
                            disabled={Boolean(running) || loading}
                            onClick={() => perform(`presence-${delivery.alumno.id}`, () => marcarPresencial(tareaId, delivery.alumno.id))}
                            className="col-span-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary"
                          >
                            Registrar entrega presencial
                          </button>
                        ) : (
                          <div className="col-span-full inline-flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            El alumno aún no entrega evidencia.
                          </div>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={Boolean(running) || loading}
                            onClick={() => perform(`review-${delivery.id}`, () => revisar(delivery.id, draft.observacion))}
                            className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40"
                          >
                            Marcar revisada
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(running) || loading}
                            onClick={() => perform(`wrong-${delivery.id}`, () => marcarIncorrecta(delivery.id, draft.observacion))}
                            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                          >
                            Marcar incorrecta
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(running) || loading}
                            onClick={() => requestCorrection(delivery, draft)}
                            className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-warning/10"
                          >
                            Pedir corrección
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(running) || loading}
                            onClick={() => saveGrade(delivery, draft)}
                            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary"
                          >
                            Calificar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
