import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/PageHeader'
import NotificacionItem, { NotificacionItemSkeleton } from '@/components/shared/NotificacionItem'
import { notify } from '@/lib/feedback'
import { useAuthStore } from '../store/authStore'
import { useNotificacionStore } from '../store/notificacionStore'
import { resolveNotificationRoute } from '../lib/notificaciones'

const PAGE_SIZE = 20

export default function NotificacionesHistorial() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const notificaciones = useNotificacionStore((s) => s.notificaciones)
  const total = useNotificacionStore((s) => s.total)
  const noLeidas = useNotificacionStore((s) => s.noLeidas)
  const loading = useNotificacionStore((s) => s.loading)
  const obtener = useNotificacionStore((s) => s.obtener)
  const marcarLeida = useNotificacionStore((s) => s.marcarLeida)
  const marcarTodasLeidas = useNotificacionStore((s) => s.marcarTodasLeidas)
  const eliminar = useNotificacionStore((s) => s.eliminar)

  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    obtener({ skip: pagina * PAGE_SIZE, take: PAGE_SIZE, soloNoLeidas })
      .catch(() => notify('No se pudieron cargar las notificaciones'))
  }, [obtener, pagina, soloNoLeidas])

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const recargarPagina = () => obtener({ skip: pagina * PAGE_SIZE, take: PAGE_SIZE, soloNoLeidas })

  const cambiarFiltro = (valor) => {
    setSoloNoLeidas(valor)
    setPagina(0)
  }

  const abrirNotificacion = (notificacion) => {
    const route = resolveNotificationRoute(notificacion, user?.rol)
    if (route) navigate(route)
    if (!notificacion.leida) marcarLeida(notificacion.id).catch(() => notify('No se pudo marcar como leída'))
  }

  const marcarUna = async (notificacion) => {
    try {
      await marcarLeida(notificacion.id)
      if (soloNoLeidas) await recargarPagina()
    } catch {
      notify('No se pudo marcar como leída')
    }
  }

  const marcarTodas = async () => {
    try {
      await marcarTodasLeidas()
      await recargarPagina()
    } catch {
      notify('No se pudieron marcar como leídas')
    }
  }

  const eliminarNotificacion = async (notificacion) => {
    try {
      await eliminar(notificacion.id)
      if (pagina > 0 && notificaciones.length === 1) setPagina((current) => current - 1)
      else await recargarPagina()
    } catch {
      notify('No se pudo eliminar la notificación')
    }
  }

  const vacio = soloNoLeidas
    ? 'No tienes notificaciones sin leer.'
    : 'Aún no tienes notificaciones. Aquí verás tareas, solicitudes y recordatorios de clase.'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notificaciones"
        subtitle="Avisos recientes: ábrelos para ir al recurso relacionado."
        action={
          <Button variant="outline" onClick={marcarTodas} disabled={!noLeidas} className="w-full sm:w-auto">
            Marcar todas leídas
          </Button>
        }
      />

      <div role="group" aria-label="Filtrar notificaciones" className="flex flex-wrap gap-2">
        <Button variant={soloNoLeidas ? 'outline' : 'default'} aria-pressed={!soloNoLeidas} onClick={() => cambiarFiltro(false)}>
          Todas
        </Button>
        <Button variant={soloNoLeidas ? 'default' : 'outline'} aria-pressed={soloNoLeidas} onClick={() => cambiarFiltro(true)}>
          No leídas ({noLeidas})
        </Button>
      </div>

      <ul aria-label="Notificaciones" aria-busy={loading || undefined}
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {loading && notificaciones.length === 0 ? (
          <NotificacionItemSkeleton count={4} />
        ) : notificaciones.length === 0 ? (
          <li className="px-6 py-12 text-center text-sm text-muted-foreground">{vacio}</li>
        ) : (
          notificaciones.map((notificacion) => (
            <NotificacionItem
              key={notificacion.id}
              notificacion={notificacion}
              onOpen={abrirNotificacion}
              onMarkRead={marcarUna}
              onDelete={eliminarNotificacion}
            />
          ))
        )}
      </ul>

      {totalPaginas > 1 && (
        <nav aria-label="Paginación de notificaciones" className="flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Página {Math.min(pagina + 1, totalPaginas)} de {totalPaginas}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPagina((current) => Math.max(0, current - 1))} disabled={pagina === 0}>
              Anterior
            </Button>
            <Button variant="outline"
              onClick={() => setPagina((current) => (current + 1 < totalPaginas ? current + 1 : current))}
              disabled={pagina + 1 >= totalPaginas}>
              Siguiente
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
