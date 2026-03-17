import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function Notificaciones() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [count, setCount] = useState(0)

  const fetchCount = () => {
    api.get('/notificaciones/no-leidas').then((r) => setCount(r.data.count)).catch(() => {})
  }

  const fetchNotifs = () => {
    api.get('/notificaciones').then((r) => setNotifs(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
    if (!open) fetchNotifs()
  }

  const marcarLeida = async (id) => {
    await api.patch(`/notificaciones/${id}/leer`)
    fetchNotifs()
    fetchCount()
  }

  const marcarTodas = async () => {
    await api.patch('/notificaciones/leer-todas')
    fetchNotifs()
    setCount(0)
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition"
      >
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-800">Notificaciones</h3>
            {count > 0 && (
              <button onClick={marcarTodas} className="text-xs text-blue-600 hover:underline">
                Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Sin notificaciones</p>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.leida && marcarLeida(n.id)}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${!n.leida ? 'bg-blue-50' : ''}`}
                >
                  <p className="text-sm font-medium text-gray-800">{n.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('es-MX')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
