import { useEffect, useRef, useState } from 'react'
import { useNotificacionStore } from '../../store/notificacionStore'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { CiBellOn } from 'react-icons/ci'
import {
  formatNotificationTime,
  getNotificationMeta,
  resolveNotificationRoute,
} from '../../lib/notificaciones'

export default function NotificacionesBell() {
  const { notificaciones, noLeidas, obtener, contarNoLeidas, marcarLeida, marcarTodasLeidas } = useNotificacionStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    contarNoLeidas()
    const interval = setInterval(contarNoLeidas, 30000)
    return () => clearInterval(interval)
  }, [contarNoLeidas])

  useEffect(() => {
    if (open) obtener({ take: 10 })
  }, [open, obtener])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClick = async (notif) => {
    if (!notif.leida) await marcarLeida(notif.id)
    setOpen(false)
    const route = resolveNotificationRoute(notif, user?.rol)
    if (route) navigate(route)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
        <CiBellOn className="w-6 h-6 text-gray-600" />
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border bg-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/notificaciones')
                }}
                className="text-xs text-slate-600 hover:underline"
              >
                Ver historial
              </button>
              {noLeidas > 0 && (
                <button onClick={() => marcarTodasLeidas()}
                  className="text-xs text-blue-600 hover:underline">
                  Marcar todas leídas
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Sin notificaciones</p>
            ) : (
              notificaciones.slice(0, 10).map((n) => {
                const { icon: TypeIcon, label } = getNotificationMeta(n.tipo)

                return (
                  <button key={n.id} onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b transition-colors ${!n.leida ? 'bg-blue-50' : ''}`}>
                    <div className="flex gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <TypeIcon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                        <p className={`text-sm truncate ${!n.leida ? 'font-semibold' : ''}`}>{n.titulo}</p>
                        <p className="text-xs text-gray-500 truncate">{n.mensaje}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatNotificationTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
