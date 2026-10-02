import { Link } from 'react-router-dom'
import { FileUp, MessageSquareText, Presentation, Signature } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABEL, conteoTarea, plazoTarea } from '@/lib/tareas'
import { Chip } from './Estados'
import { MenuAcciones } from './Controles'
import TiraEntregas from './TiraEntregas'

const ICONO_TIPO = { EN_LINEA: FileUp, PRESENCIAL: Presentation, FIRMA: Signature, REVISION_EN_LINEA: MessageSquareText }

/** Una tarea dentro de su unidad: título, plazo, quién falta y una sola acción principal. */
export default function FilaTarea({ tarea, items, publicando, onPublicar }) {
  const Icon = ICONO_TIPO[tarea.tipoEntrega] ?? FileUp
  const p = plazoTarea(tarea)
  const r = conteoTarea(tarea)
  const borrador = tarea.estado === 'BORRADOR'
  const cerrada = tarea.estado === 'CERRADA'
  const presencial = tarea.tipoEntrega === 'PRESENCIAL'
  const vencida = tarea.estado === 'VENCIDA' || cerrada
  const sesion = `/docente/tareas/${tarea.id}`

  let accion
  if (borrador) {
    accion = <Button variant="outline" onClick={onPublicar} disabled={publicando}>{publicando ? 'Publicando…' : 'Publicar'}</Button>
  } else if (r.porCalificar > 0) {
    accion = (
      <Link to={sesion} className={buttonVariants({ variant: 'outline' })} aria-label={`Calificar ${r.porCalificar} ${r.porCalificar === 1 ? 'entrega' : 'entregas'} de ${tarea.titulo}`}>
        Calificar<span className="rounded-full bg-warning/20 px-1.5 text-xs font-semibold tabular-nums text-warning-foreground">{r.porCalificar}</span>
      </Link>
    )
  } else if (presencial && !vencida) {
    accion = <Link to={sesion} className={buttonVariants({ variant: 'outline' })}>Registrar entregas</Link>
  } else {
    accion = <Link to={sesion} className={cn(buttonVariants({ variant: 'ghost' }), 'text-muted-foreground')}>Ver entregas</Link>
  }

  let detalle
  if (borrador) detalle = <>Sin publicar · se asignará a {r.total} {r.total === 1 ? 'alumno' : 'alumnos'}</>
  else if (presencial && !vencida && r.entregadas === 0) detalle = 'Se registra en clase'
  else {
    detalle = (
      <>
        <span className="font-medium text-foreground tabular-nums">{r.entregadas} de {r.total}</span>
        {r.porCalificar > 0 && <> · <span className="font-medium text-warning-foreground tabular-nums">{r.porCalificar}</span> por calificar</>}
        {r.porCalificar === 0 && r.entregadas > 0 && <> · todo revisado</>}
        {vencida && r.sinEntregar > 0 && <> · <span className="font-medium text-destructive-foreground tabular-nums">{r.sinEntregar}</span> {r.sinEntregar === 1 ? 'falta' : 'faltan'}</>}
      </>
    )
  }

  return (
    <li className="grid grid-cols-1 items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 last:border-b-0 sm:px-5 @2xl:grid-cols-[minmax(0,1fr)_auto] @4xl:grid-cols-[minmax(0,1fr)_8.5rem_16rem_12.5rem]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h4 className="text-[15px] font-medium leading-snug">
            <Link to={borrador ? `/docente/tareas/crear?editarId=${tarea.id}` : sesion} className="text-foreground underline-offset-4 hover:underline">
              {tarea.titulo}
            </Link>
          </h4>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
            {TASK_TYPE_LABEL[tarea.tipoEntrega] ?? tarea.tipoEntrega}{tarea.tipoEvaluacion === 'RUBRICA' && <> · Rúbrica</>}
            {tarea.categoria?.nombre && <> · {tarea.categoria.nombre}</>}
            {borrador && <Chip tone="muted" className="ml-1 h-5">Borrador</Chip>}
            {cerrada && <Chip tone="neutral" className="ml-1 h-5">Cerrada</Chip>}
          </p>
        </div>
      </div>
      <div className="order-last flex items-center gap-1 justify-self-start pl-11 @2xl:order-none @2xl:col-start-2 @2xl:row-start-1 @2xl:justify-self-end @2xl:pl-0 @4xl:order-last @4xl:col-start-auto @4xl:row-start-auto">
        {accion}
        <MenuAcciones label={`Más acciones de ${tarea.titulo}`} items={items} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-11 @2xl:col-span-2 @4xl:contents">
        <div className="text-[13px] leading-tight">
          {cerrada ? (
            <>
              <p className="font-medium text-foreground">Promedio <span className="tabular-nums">{r.promedio ?? '—'}</span></p>
              {p.texto && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">Límite {p.texto}</p>}
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">{p.relativo}</p>
              {p.texto && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{p.texto}</p>}
            </>
          )}
        </div>
        <div className="min-w-0">
          {!borrador && r.total > 0 && <TiraEntregas conteo={r} vencida={vencida} className="mb-1.5" />}
          <p className="text-xs text-muted-foreground">{detalle}</p>
        </div>
      </div>
    </li>
  )
}
