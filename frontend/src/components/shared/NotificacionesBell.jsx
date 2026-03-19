import { useEffect, useRef, useState } from 'react'
import { useNotificacionStore } from '../../store/notificacionStore'
import { useNavigate } from 'react-router-dom'

const TIPO_ICONS = {
  INSCRIPCION_NUEVA: '📝',
  INSCRIPCION_ACEPTADA: '✅',
  INSCRIPCION_RECHAZADA: '❌',
  CLASE_INICIADA: '🎓',
  CLASE_FINALIZADA: '🏁',
  TAREA_NUEVA: '📚',
  TAREA_REVISADA: '👁',
  TAREA_CALIFICADA: '⭐',
  ENTREGA_RECIBIDA: '📬',
}

function tiempoRelativo(fecha) {
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export default function NotificacionesBell() {
  const { notificaciones, noLeidas, obtener, contarNoLeidas, marcarLeida } = useNotificacionStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    contarNoLeidas()
    const interval = setInterval(contarNoLeidas, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) obtener()
  }, [open])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClick = async (notif) => {
    if (!notif.leida) await marcarLeida(notif.id)
    setOpen(false)
    if (notif.referenciaTipo === 'Tarea' && notif.referenciaId) navigate(`/alumno/tareas/${notif.referenciaId}`)
    else if (notif.referenciaTipo === 'Inscripcion') navigate('/inscripciones')
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
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
            {noLeidas > 0 && (
              <button onClick={() => useNotificacionStore.getState().marcarTodasLeidas()}
                className="text-xs text-blue-600 hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Sin notificaciones</p>
            ) : (
              notificaciones.slice(0, 10).map((n) => (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b transition-colors ${!n.leida ? 'bg-blue-50' : ''}`}>
                  <div className="flex gap-2">
                    <span className="text-lg leading-none">{TIPO_ICONS[n.tipo] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.leida ? 'font-semibold' : ''}`}>{n.titulo}</p>
                      <p className="text-xs text-gray-500 truncate">{n.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tiempoRelativo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
