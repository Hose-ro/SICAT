import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Popover } from '@base-ui/react/popover'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NotificacionItem, { NotificacionItemSkeleton } from './NotificacionItem'
import { useNotificacionStore } from '../../store/notificacionStore'
import { useAuthStore } from '../../store/authStore'
import { notify } from '@/lib/feedback'
import { resolveNotificationRoute } from '../../lib/notificaciones'

// Polling lives in BaseLayout (useNotificacionesPolling) so the two bells
// (mobile top bar and desktop bar) share one timer.
export default function NotificacionesBell() {
  const recientes = useNotificacionStore((s) => s.recientes)
  const loading = useNotificacionStore((s) => s.loadingRecientes)
  const noLeidas = useNotificacionStore((s) => s.noLeidas)
  const obtenerRecientes = useNotificacionStore((s) => s.obtenerRecientes)
  const marcarLeida = useNotificacionStore((s) => s.marcarLeida)
  const marcarTodasLeidas = useNotificacionStore((s) => s.marcarTodasLeidas)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) obtenerRecientes().catch(() => notify('No se pudieron cargar las notificaciones'))
  }, [open, obtenerRecientes])

  const abrir = (notificacion) => {
    setOpen(false)
    const route = resolveNotificationRoute(notificacion, user?.rol)
    if (route) navigate(route)
    // Navigation must not wait on the read receipt.
    if (!notificacion.leida) marcarLeida(notificacion.id).catch(() => notify('No se pudo marcar como leída'))
  }

  const etiqueta = noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'
  const mostrarSkeleton = loading && recientes.length === 0

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<Button variant="ghost" size="icon" aria-label={etiqueta} className="relative size-10 text-muted-foreground hover:text-foreground" />}
      >
        <Bell className="size-5" aria-hidden="true" />
        {noLeidas > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold leading-none text-primary-foreground">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8} className="z-[150]">
          <Popover.Popup aria-label="Notificaciones" aria-busy={mostrarSkeleton || undefined}
            className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-lg outline-none">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
              <h2 className="text-sm font-semibold">Notificaciones</h2>
              {noLeidas > 0 && (
                <Button variant="ghost" size="sm"
                  onClick={() => marcarTodasLeidas().catch(() => notify('No se pudieron marcar como leídas'))}>
                  Marcar todas leídas
                </Button>
              )}
            </div>
            <ul aria-label="Notificaciones recientes" className="max-h-[min(24rem,60dvh)] divide-y divide-border overflow-y-auto overscroll-contain py-1">
              {mostrarSkeleton ? (
                <NotificacionItemSkeleton compact />
              ) : recientes.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin avisos por ahora. Aquí verás tareas, solicitudes y recordatorios de clase.
                </li>
              ) : (
                recientes.map((n) => <NotificacionItem key={n.id} notificacion={n} compact onOpen={abrir} />)
              )}
            </ul>
            <Link to="/notificaciones" onClick={() => setOpen(false)}
              className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary-ink hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
              Ver historial
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
