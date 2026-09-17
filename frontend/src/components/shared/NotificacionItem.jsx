import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  NOTIFICATION_TONE_CLASS,
  formatNotificationDateTime,
  formatNotificationTime,
  getNotificationMeta,
} from '@/lib/notificaciones'

// One row for the bell (compact) and the history page. The row itself is the
// only control that opens the notification; optional actions sit beside it so
// no interactive element nests inside another.
export default function NotificacionItem({ notificacion, compact = false, onOpen, onMarkRead, onDelete }) {
  const { icon: Icono, label, tone } = getNotificationMeta(notificacion.tipo)
  const noLeida = !notificacion.leida
  const acciones = Boolean((onMarkRead && noLeida) || onDelete)

  return (
    <li className={cn('flex items-start gap-2', compact ? 'px-2 py-1' : 'px-3 py-2 sm:px-4')}>
      <Button variant="ghost" size="row" onClick={() => onOpen?.(notificacion)}
        className={cn('flex min-w-0 flex-1 items-start gap-3 rounded-xl', compact ? 'px-2 py-2' : 'px-2 py-3')}>
        <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full', compact ? 'h-8 w-8' : 'h-10 w-10', NOTIFICATION_TONE_CLASS[tone])}>
          <Icono className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {noLeida && <><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" /><span className="sr-only">Sin leer.</span></>}
            <span className="truncate">{label}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={notificacion.createdAt} title={formatNotificationDateTime(notificacion.createdAt)} className="shrink-0">
              {formatNotificationTime(notificacion.createdAt)}
            </time>
          </span>
          <span className={cn('mt-0.5 block text-sm text-foreground', noLeida ? 'font-semibold' : 'font-medium', compact ? 'truncate' : 'line-clamp-2')}>
            {notificacion.titulo}
          </span>
          {notificacion.mensaje && (
            <span className={cn('mt-0.5 block text-sm text-muted-foreground', compact ? 'line-clamp-2 text-xs' : 'line-clamp-2')}>
              {notificacion.mensaje}
            </span>
          )}
        </span>
      </Button>

      {acciones && (
        <span className="flex shrink-0 flex-col gap-1 pt-1 sm:flex-row">
          {onMarkRead && noLeida && (
            <Button variant="ghost" size="icon" aria-label={`Marcar leída: ${notificacion.titulo}`} onClick={() => onMarkRead(notificacion)}>
              <Check aria-hidden="true" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" aria-label={`Eliminar: ${notificacion.titulo}`} onClick={() => onDelete(notificacion)}>
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </span>
      )}
    </li>
  )
}

export function NotificacionItemSkeleton({ compact = false, count = 3 }) {
  return Array.from({ length: count }, (_, index) => (
    <li key={index} aria-hidden="true" className={cn('flex items-start gap-3 animate-pulse', compact ? 'px-4 py-3' : 'px-5 py-5')}>
      <span className={cn('shrink-0 rounded-full bg-muted', compact ? 'h-8 w-8' : 'h-10 w-10')} />
      <span className="flex-1 space-y-2 pt-1">
        <span className="block h-3 w-24 rounded bg-muted" />
        <span className="block h-4 w-3/4 rounded bg-muted" />
        <span className="block h-3 w-1/2 rounded bg-muted" />
      </span>
    </li>
  ))
}
