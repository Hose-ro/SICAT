import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificacionStore } from '../store/notificacionStore'
import {
  formatNotificationTime,
  getNotificationMeta,
  resolveNotificationRoute,
} from '../lib/notificaciones'

const PAGE_SIZE = 20

export default function NotificacionesHistorial() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const {
    notificaciones,
    total,
    noLeidas,
    loading,
    obtener,
    contarNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
    eliminar,
  } = useNotificacionStore()

  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    obtener({
      skip: pagina * PAGE_SIZE,
      take: PAGE_SIZE,
      soloNoLeidas,
    })
  }, [obtener, pagina, soloNoLeidas])

  useEffect(() => {
    contarNoLeidas()
  }, [contarNoLeidas])

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const recargarPagina = () =>
    obtener({
      skip: pagina * PAGE_SIZE,
      take: PAGE_SIZE,
      soloNoLeidas,
    })

  const abrirNotificacion = async (notificacion) => {
    if (!notificacion.leida) {
      await marcarLeida(notificacion.id)
      if (soloNoLeidas) {
        await recargarPagina()
      }
    }

    const route = resolveNotificationRoute(notificacion, user?.rol)
    if (route) {
      navigate(route)
    }
  }

  const eliminarNotificacion = async (event, id) => {
    event.stopPropagation()
    await eliminar(id)
    await recargarPagina()

    if (pagina > 0 && notificaciones.length === 1) {
      setPagina((current) => current - 1)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Notificaciones</h1>
            <p className="text-sm text-slate-500">
              Revisa avisos recientes, marca leídas y abre el recurso relacionado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSoloNoLeidas(false)
                setPagina(0)
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                !soloNoLeidas
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => {
                setSoloNoLeidas(true)
                setPagina(0)
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                soloNoLeidas
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              No leídas ({noLeidas})
            </button>
            <button
              onClick={async () => {
                await marcarTodasLeidas()
                await recargarPagina()
              }}
              disabled={!noLeidas}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar todas
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Cargando notificaciones...</div>
        ) : notificaciones.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            No hay notificaciones para los filtros actuales.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notificaciones.map((notificacion) => {
              const { icon: Icono, label } = getNotificationMeta(notificacion.tipo)

              return (
                <div
                  key={notificacion.id}
                  onClick={() => abrirNotificacion(notificacion)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      abrirNotificacion(notificacion)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50 ${
                    !notificacion.leida ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <Icono className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                        <p className={`truncate text-sm text-slate-900 ${!notificacion.leida ? 'font-semibold' : 'font-medium'}`}>
                          {notificacion.titulo}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatNotificationTime(notificacion.createdAt)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">{notificacion.mensaje}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!notificacion.leida && (
                        <button
                          onClick={async (event) => {
                            event.stopPropagation()
                            await marcarLeida(notificacion.id)
                            if (soloNoLeidas) {
                              await recargarPagina()
                            }
                          }}
                          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          Marcar leída
                        </button>
                      )}
                      <button
                        onClick={(event) => eliminarNotificacion(event, notificacion.id)}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm text-slate-500">
          Página {Math.min(pagina + 1, totalPaginas)} de {totalPaginas}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPagina((current) => Math.max(0, current - 1))}
            disabled={pagina === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            onClick={() =>
              setPagina((current) =>
                current + 1 < totalPaginas ? current + 1 : current,
              )
            }
            disabled={pagina + 1 >= totalPaginas}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
