import { useEffect, useMemo, useState } from 'react'
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

const STATE_CLASS = {
  PENDIENTE: 'bg-slate-100 text-slate-700',
  ENTREGADA: 'bg-sky-100 text-sky-700',
  REVISADA: 'bg-violet-100 text-violet-700',
  INCORRECTA: 'bg-rose-100 text-rose-700',
  CALIFICADA: 'bg-emerald-100 text-emerald-700',
  NO_ENTREGADA: 'bg-amber-100 text-amber-700',
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
    obtenerDetalle,
    obtenerEntregas,
    revisar,
    revisarMasivo,
    calificar,
    marcarIncorrecta,
    devolverParaCorreccion,
    descargarEntregas,
    marcarPresencial,
    loading,
  } = useTareaStore()

  const [filters, setFilters] = useState({ estado: '', tardia: false, q: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [drafts, setDrafts] = useState({})
  const [running, setRunning] = useState(null)

  const load = async () => {
    await Promise.all([
      obtenerDetalle(tareaId),
      obtenerEntregas(tareaId, {
        estado: filters.estado || undefined,
        tardia: filters.tardia || undefined,
        q: filters.q || undefined,
      }),
    ])
  }

  useEffect(() => {
    load().catch(() => {})
  }, [tareaId, filters.estado, filters.tardia, filters.q])

  useEffect(() => {
    setSelectedIds([])
  }, [filters])

  const selectedDeliveries = useMemo(
    () => entregas.filter((item) => !item.esSintetica && selectedIds.includes(item.id)),
    [entregas, selectedIds],
  )

  const updateDraft = (deliveryId, changes) => {
    setDrafts((prev) => ({
      ...prev,
      [deliveryId]: {
        observacion: prev[deliveryId]?.observacion ?? '',
        calificacion: prev[deliveryId]?.calificacion ?? '',
        calificacionTipo: prev[deliveryId]?.calificacionTipo ?? 'NUMERICA',
        ...changes,
      },
    }))
  }

  const perform = async (key, callback) => {
    setRunning(key)
    try {
      await callback()
      await load()
    } finally {
      setRunning(null)
    }
  }

  if (!tareaActiva && loading) {
    return <div className="px-4 py-8 text-sm text-slate-500">Cargando revisión de entregas...</div>
  }

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
                  {tareaActiva.estado}
                </span>
                {tareaActiva.entregasTardias > 0 && (
                  <span className="rounded-full border border-amber-200/80 bg-amber-100/85 px-3 py-1 text-xs font-semibold text-amber-800">
                    {tareaActiva.entregasTardias} tardías
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{tareaActiva.titulo}</h1>
                <p className="task-hero-subtitle mt-2 max-w-3xl text-sm">{tareaActiva.instrucciones}</p>
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

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-4 xl:flex-row">
            <label className="flex min-w-[11rem] flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estado</span>
              <select
                value={filters.estado}
                onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
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
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Buscar alumno</span>
              <input
                type="search"
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                placeholder="Nombre o control"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
              />
            </label>

            <label className="mt-auto inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={filters.tardia}
                onChange={(event) => setFilters((prev) => ({ ...prev, tardia: event.target.checked }))}
              />
              Solo tardías
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedDeliveries.length === 0 || running === 'bulk-review'}
              onClick={() => perform('bulk-review', () => revisarMasivo(tareaId, selectedDeliveries.map((item) => item.id), 'Revisión masiva docente'))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <SquareCheckBig className="h-4 w-4" />
              Marcar seleccionadas
            </button>
            <button
              type="button"
              disabled={selectedDeliveries.length === 0 || running === 'bulk-download'}
              onClick={() => perform('bulk-download', () => descargarEntregas(tareaId, selectedDeliveries.map((item) => item.id)))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Descargar seleccionadas
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">{entregasStats?.pendientes ?? 0} pendientes</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{entregasStats?.revisadas ?? 0} revisadas</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{entregasStats?.incorrectas ?? 0} incorrectas</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{entregasStats?.tardias ?? 0} tardías</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{entregasStats?.noEntregadas ?? 0} no entregadas</span>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
          Cargando cards de revisión...
        </div>
      ) : (
        <section className="grid gap-4 2xl:grid-cols-2">
          {entregas.map((delivery) => {
            const draft = drafts[delivery.id] || {
              observacion: delivery.observacion || '',
              calificacion: delivery.calificacion ?? '',
              calificacionTipo: delivery.calificacionTipo || 'NUMERICA',
            }

            return (
              <article key={delivery.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {!delivery.esSintetica && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(delivery.id)}
                          onChange={() => setSelectedIds((prev) => prev.includes(delivery.id)
                            ? prev.filter((value) => value !== delivery.id)
                            : [...prev, delivery.id])}
                        />
                      )}
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_CLASS[delivery.estadoRevision] || 'bg-slate-100 text-slate-700'}`}>
                        {delivery.estadoRevision}
                      </span>
                      {delivery.fueTardia && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Tardía
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{delivery.alumno.nombre}</h3>
                      <p className="mt-1 text-sm text-slate-500">No. control: {delivery.alumno.numeroControl || 'Sin registro'}</p>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><span className="font-semibold text-slate-800">Fecha:</span> {delivery.fechaEntrega ? formatDateTime(delivery.fechaEntrega) : 'Sin entrega'}</p>
                      <p><span className="font-semibold text-slate-800">Versión:</span> {delivery.versionEntrega || 0}</p>
                    </div>

                    {delivery.comentarioAlumno && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <div className="mb-2 flex items-center gap-2 text-slate-800">
                          <MessageSquare className="h-4 w-4" />
                          <span className="font-semibold">Comentario del alumno</span>
                        </div>
                        <p>{delivery.comentarioAlumno}</p>
                      </div>
                    )}

                    {delivery.archivos?.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <div className="mb-3 flex items-center gap-2 text-slate-800">
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
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <FileBadge2 className="h-3.5 w-3.5" />
                              {file.nombre}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-md space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Calificación</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={draft.calificacionTipo !== 'NUMERICA' || delivery.esSintetica}
                          value={draft.calificacion}
                          onChange={(event) => updateDraft(delivery.id, { calificacion: event.target.value })}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:bg-slate-100"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tipo</span>
                        <select
                          disabled={delivery.esSintetica}
                          value={draft.calificacionTipo}
                          onChange={(event) => updateDraft(delivery.id, { calificacionTipo: event.target.value })}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:bg-slate-100"
                        >
                          {CALIFICATION_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Observación docente</span>
                      <textarea
                        rows={4}
                        disabled={delivery.esSintetica}
                        value={draft.observacion}
                        onChange={(event) => updateDraft(delivery.id, { observacion: event.target.value })}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:bg-slate-100"
                      />
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {delivery.esSintetica ? (
                        tareaActiva?.tipoEntrega === 'PRESENCIAL' ? (
                          <button
                            type="button"
                            onClick={() => perform(`presence-${delivery.alumno.id}`, () => marcarPresencial(tareaId, delivery.alumno.id))}
                            className="col-span-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Registrar entrega presencial
                          </button>
                        ) : (
                          <div className="col-span-full inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                            El alumno aún no entrega evidencia.
                          </div>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => perform(`review-${delivery.id}`, () => revisar(delivery.id, draft.observacion))}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Revisar
                          </button>
                          <button
                            type="button"
                            onClick={() => perform(`wrong-${delivery.id}`, () => marcarIncorrecta(delivery.id, draft.observacion))}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Incorrecta
                          </button>
                          <button
                            type="button"
                            onClick={() => perform(`return-${delivery.id}`, () => devolverParaCorreccion(delivery.id, draft.observacion, true))}
                            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                          >
                            Pedir corrección
                          </button>
                          <button
                            type="button"
                            onClick={() => perform(`grade-${delivery.id}`, () => calificar(delivery.id, {
                              observacion: draft.observacion,
                              calificacion: draft.calificacion === '' ? undefined : Number(draft.calificacion),
                              calificacionTipo: draft.calificacionTipo,
                            }))}
                            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
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
