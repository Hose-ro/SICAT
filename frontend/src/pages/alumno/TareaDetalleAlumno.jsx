import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileBadge2 } from 'lucide-react'
import api from '../../api/axios'
import FormEntregaTarea from './components/FormEntregaTarea'
import { useTareaStore } from '../../store/tareaStore'

import TaskCriteria from '../../components/TaskCriteria'
import TaskNotice from '../../components/TaskNotice'
import EquiposTarea from '../../components/EquiposTarea'
import { deliveryHelp, esEnClase, etiquetaEstadoAlumno, taskFileUrl } from '../../lib/tareas'

const STATE_CLASS = {
  PENDIENTE: 'bg-muted text-foreground',
  ENTREGADA: "bg-primary/10 text-primary-ink",
  REVISADA: "bg-primary/10 text-primary-ink",
  INCORRECTA: "bg-destructive/18 text-destructive-foreground",
  CALIFICADA: 'bg-success/18 text-foreground',
  NO_ENTREGADA: 'bg-warning/18 text-foreground',
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

  const calificacion = typeof miEntrega?.calificacion === 'number' ? miEntrega.calificacion : miEntrega?.calificacionTipo
  const enlaceArchivo = 'inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground underline-offset-4 transition-colors hover:bg-muted hover:underline'

  return (
    <div className="mx-auto max-w-[76rem] space-y-6">
      <Link to="/tareas" className="inline-flex min-h-9 items-center gap-2 rounded-[10px] px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />Mis tareas
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_CLASS[estadoAlumno] || 'bg-muted text-foreground'}`}>
            {etiquetaEstadoAlumno(estadoAlumno, tareaActiva, Boolean(miEntrega))}
          </span>
          {miEntrega?.fueTardia && (
            <span className="rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">Entrega tardía</span>
          )}
        </div>
        <h1 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">{tareaActiva.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {[tareaActiva.materia?.nombre, tareaActiva.grupo?.nombre, tareaActiva.unidadRef?.nombre].filter(Boolean).join(' · ')}
          {' · '}Fecha límite: <span className="text-foreground">{tareaActiva.tieneFechaLimite ? formatDateTime(tareaActiva.fechaLimite) : 'sin límite'}</span>
        </p>
        {tareaActiva.instrucciones && (
          <p className="max-w-3xl whitespace-pre-wrap pt-1 text-sm text-foreground">{tareaActiva.instrucciones}</p>
        )}
      </header>

      <TaskCriteria tarea={tareaActiva} />
      {tareaActiva.esGrupal && <EquiposTarea tareaId={tareaActiva.id} rol="ALUMNO" onChange={() => obtenerDetalle(Number(id)).catch(() => {})} />}
      <TaskNotice error={error} />
      {tareaActiva.archivos?.length > 0 && (
        <section aria-labelledby="material-docente" className="rounded-[var(--radius-card)] border border-border bg-card p-5">
          <h2 id="material-docente" className="text-base font-semibold text-foreground">Material de apoyo del docente</h2>
          <div className="mt-3 flex flex-wrap gap-2">{tareaActiva.archivos.map((file) => (
            <a key={file.id} href={taskFileUrl(file.url, api.defaults.baseURL)} target="_blank" rel="noreferrer" className={enlaceArchivo}>
              <FileBadge2 className="size-4" aria-hidden="true" />{file.nombre}
            </a>
          ))}</div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <section aria-labelledby="tu-entrega" className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
          <h2 id="tu-entrega" className="text-lg font-semibold text-foreground">Tu entrega</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Calificación</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">{calificacion ?? 'Sin calificar'}</dd>
            <dt className="text-muted-foreground">Entregada</dt>
            <dd className="text-foreground">{miEntrega?.fechaEntrega ? formatDateTime(miEntrega.fechaEntrega) : 'Aún no'}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="text-foreground">{deliveryHelp(tareaActiva, miEntrega, tareaActiva.puedeEditarEntrega)}</dd>
          </dl>

          {miEntrega?.observacion && (
            <div className="mt-5 rounded-[var(--radius-item)] bg-success/18 px-4 py-3 text-sm text-foreground">
              <p className="font-medium">Observación de tu docente</p>
              <p className="mt-1">{miEntrega.observacion}</p>
            </div>
          )}
          {miEntrega?.comentarioAlumno && (
            <div className="mt-3 rounded-[var(--radius-item)] bg-muted/60 px-4 py-3 text-sm text-foreground">
              <p className="font-medium">Tu comentario</p>
              <p className="mt-1 text-muted-foreground">{miEntrega.comentarioAlumno}</p>
            </div>
          )}
          {miEntrega?.archivos?.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-foreground">Archivos que entregaste</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {miEntrega.archivos.map((file) => (
                  <a key={file.id} href={taskFileUrl(file.url, api.defaults.baseURL)} target="_blank" rel="noreferrer" className={enlaceArchivo}>
                    <FileBadge2 className="size-4" aria-hidden="true" />{file.nombre}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="entregar" className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
          <h2 id="entregar" className="text-lg font-semibold text-foreground">
            {esEnClase(tareaActiva) ? 'Se aplica en clase' : miEntrega ? 'Actualizar entrega' : 'Entregar tarea'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {esEnClase(tareaActiva)
              ? 'No necesitas subir nada: tu docente captura la calificación después de la clase.'
              : 'Puedes subir varios archivos y quitar los que ya no quieras antes de volver a enviar.'}
          </p>
          {tareaActiva.esGrupal && !tareaActiva.miEquipo && <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-foreground">Forma o únete a un equipo antes de entregar.</p>}
          <div className="mt-5">
            <FormEntregaTarea
              key={tareaActiva.id}
              tarea={tareaActiva}
              miEntrega={miEntrega}
              puedeEditar={tareaActiva.puedeEditarEntrega && (!tareaActiva.esGrupal || Boolean(tareaActiva.miEquipo))}
              onSuccess={() => obtenerDetalle(Number(id)).catch(() => {})}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
