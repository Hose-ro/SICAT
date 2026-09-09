import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileBadge2, MessageSquare } from 'lucide-react'
import api from '../../api/axios'
import FormEntregaTarea from './components/FormEntregaTarea'
import { useTareaStore } from '../../store/tareaStore'

import TaskCriteria from '../../components/TaskCriteria'
import TaskNotice from '../../components/TaskNotice'
import { DELIVERY_STATE_LABEL, deliveryHelp } from '../../lib/tareas'

const STATE_CLASS = {
  PENDIENTE: 'bg-muted text-foreground',
  ENTREGADA: 'bg-primary/10 text-primary',
  REVISADA: 'bg-primary/10 text-primary',
  INCORRECTA: 'bg-destructive/10 text-destructive',
  CALIFICADA: 'bg-success/10 text-foreground',
  NO_ENTREGADA: 'bg-warning/10 text-foreground',
}

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

export default function TareaDetalleAlumno() {
  const { id } = useParams()
  const { tareaActiva, obtenerDetalle, error } = useTareaStore()

  useEffect(() => {
    obtenerDetalle(Number(id)).catch(() => {})
  }, [id, obtenerDetalle])

  if ((!tareaActiva || tareaActiva.id !== Number(id)) && !error) {
    return <div className="px-4 py-8 text-sm text-muted-foreground">Cargando tarea...</div>
  }

  if (!tareaActiva || tareaActiva.id !== Number(id)) {
    return <TaskNotice error={error || 'No fue posible cargar la tarea.'} onRetry={() => obtenerDetalle(Number(id)).catch(() => {})} />
  }

  const estadoAlumno = tareaActiva.estadoAlumno || tareaActiva.miEntrega?.estadoRevision || 'PENDIENTE'
  const miEntrega = tareaActiva.miEntrega || null

  return (
    <div className="space-y-6">
      <section className="task-hero px-6 py-7">
        <Link
          to="/tareas"
          className="task-hero-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a tareas
        </Link>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_CLASS[estadoAlumno] || 'task-hero-badge'}`}>
                {DELIVERY_STATE_LABEL[estadoAlumno] || estadoAlumno}
              </span>
              {miEntrega?.fueTardia && (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-foreground">
                  Entrega tardía
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
              <p><span className="task-hero-emphasis font-semibold">Fecha límite:</span> {tareaActiva.tieneFechaLimite ? formatDateTime(tareaActiva.fechaLimite) : 'Sin límite'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="task-hero-surface rounded-3xl p-4">
              <p className="task-hero-meta text-xs uppercase tracking-[0.16em]">Calificación</p>
              <p className="mt-2 text-3xl font-semibold">
                {typeof miEntrega?.calificacion === 'number'
                  ? miEntrega.calificacion
                  : miEntrega?.calificacionTipo || 'Pendiente'}
              </p>
            </div>
            <div className="task-hero-surface rounded-3xl p-4">
              <p className="task-hero-meta text-xs uppercase tracking-[0.16em]">Entrega</p>
              <p className="mt-2 text-lg font-semibold">
                {miEntrega?.fechaEntrega ? formatDateTime(miEntrega.fechaEntrega) : 'Aún sin entregar'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <TaskCriteria tarea={tareaActiva} />
      <TaskNotice error={error} />
      {tareaActiva.archivos?.length > 0 && <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Material de apoyo del docente</h2>
        <div className="mt-3 flex flex-wrap gap-3">{tareaActiva.archivos.map((file) => (
          <a key={file.id} href={resolveApiUrl(file.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm underline underline-offset-4"><FileBadge2 className="h-4 w-4" />{file.nombre}</a>
        ))}</div>
      </section>}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-border bg-muted/40 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <Clock3 className="h-4 w-4" />
                <p className="text-sm font-semibold">Estado de la entrega</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {deliveryHelp(tareaActiva, miEntrega, tareaActiva.puedeEditarEntrega)}
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-muted/40 p-5">
              <div className="flex items-center gap-2 text-foreground">
                <CalendarDays className="h-4 w-4" />
                <p className="text-sm font-semibold">Fecha límite</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {tareaActiva.tieneFechaLimite ? formatDateTime(tareaActiva.fechaLimite) : 'Sin fecha límite'}
              </p>
            </div>
          </div>

          {miEntrega && (
            <div className="mt-6 space-y-4">
              {miEntrega.comentarioAlumno && (
                <div className="rounded-3xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 text-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-semibold">Tu comentario</span>
                  </div>
                  <p>{miEntrega.comentarioAlumno}</p>
                </div>
              )}

              {miEntrega.observacion && (
                <div className="rounded-3xl border border-success/30 bg-success/10 p-5 text-sm text-foreground">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">Observación del docente</span>
                  </div>
                  <p>{miEntrega.observacion}</p>
                </div>
              )}

              {miEntrega.archivos?.length > 0 && (
                <div className="rounded-3xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
                  <p className="mb-3 text-sm font-semibold text-foreground">Archivos de tu entrega</p>
                  <div className="flex flex-wrap gap-2">
                    {miEntrega.archivos.map((file) => (
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
          )}
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            {miEntrega ? 'Actualizar entrega' : 'Entregar tarea'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sube múltiples archivos, conserva evidencia existente o remueve archivos antes de reenviar.
          </p>
          <div className="mt-5">
            <FormEntregaTarea
              key={tareaActiva.id}
              tarea={tareaActiva}
              miEntrega={miEntrega}
              puedeEditar={tareaActiva.puedeEditarEntrega}
              onSuccess={() => obtenerDetalle(Number(id)).catch(() => {})}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
