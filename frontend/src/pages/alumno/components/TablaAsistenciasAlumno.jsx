import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'

const ESTADO_CONFIG = {
  ASISTENCIA:  { label: 'Asistencia',  bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  FALTA:       { label: 'Falta',       bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200',    dot: 'bg-rose-500'    },
  RETARDO:     { label: 'Retardo',     bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400'   },
  JUSTIFICADA: { label: 'Justificada', bg: 'bg-sky-50',     text: 'text-sky-700',     ring: 'ring-sky-200',     dot: 'bg-sky-500'     },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado]
  if (!cfg) return <span className="text-xs text-slate-400">Sin registro</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function SummaryChip({ estado, count }) {
  const cfg = ESTADO_CONFIG[estado]
  if (!cfg || count === 0) return null
  return (
    <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 ring-1 ${cfg.bg} ${cfg.ring}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      <span className={`text-xs font-semibold ${cfg.text}`}>{count}</span>
      <span className={`text-[11px] ${cfg.text} opacity-70`}>{cfg.label.toLowerCase()}{count !== 1 ? 's' : ''}</span>
    </div>
  )
}

function formatDateShort(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TablaAsistenciasAlumno({ materiaId }) {
  const { misAsistencias, obtenerMisAsistencias, justificar, loading } = useAsistenciaStore()
  const [unidad, setUnidad] = useState('')
  const [justModal, setJustModal] = useState(null)
  const [justText, setJustText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    obtenerMisAsistencias(materiaId)
    const interval = setInterval(() => {
      obtenerMisAsistencias(materiaId).catch(() => {})
    }, 20000)
    return () => clearInterval(interval)
  }, [materiaId])

  const filtradas = unidad
    ? misAsistencias.filter((a) => a.unidad === Number(unidad))
    : misAsistencias

  const totales = filtradas.reduce((acc, a) => {
    if (a.estado) acc[a.estado] = (acc[a.estado] || 0) + 1
    return acc
  }, {})

  const totalRegistrado = Object.values(totales).reduce((s, v) => s + v, 0)
  const pctAsistencia = totalRegistrado > 0
    ? Math.round(((totales.ASISTENCIA ?? 0) / totalRegistrado) * 100)
    : null

  const hoy = new Date().toDateString()
  const asistenciaDeHoy = filtradas.find((a) => new Date(a.fecha).toDateString() === hoy)

  const handleJustificar = async () => {
    if (!justText.trim()) return
    setSubmitting(true)
    try {
      await justificar(justModal, justText)
      setJustModal(null)
      setJustText('')
      obtenerMisAsistencias(materiaId)
    } catch {
      alert('Error al justificar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {asistenciaDeHoy?.estado && (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
          asistenciaDeHoy.estado === 'ASISTENCIA' ? 'border-emerald-200 bg-emerald-50' :
          asistenciaDeHoy.estado === 'FALTA' ? 'border-rose-200 bg-rose-50' :
          'border-amber-200 bg-amber-50'
        }`}>
          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTADO_CONFIG[asistenciaDeHoy.estado]?.dot}`} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoy</p>
            <p className="text-sm font-medium text-slate-800">
              {ESTADO_CONFIG[asistenciaDeHoy.estado]?.label}
              <span className="ml-2 font-normal text-slate-500">
                {asistenciaDeHoy.grupo?.nombre ?? ''} {asistenciaDeHoy.unidad ? `· Unidad ${asistenciaDeHoy.unidad}` : ''}
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['ASISTENCIA', 'FALTA', 'RETARDO', 'JUSTIFICADA'].map((e) => (
            <SummaryChip key={e} estado={e} count={totales[e] ?? 0} />
          ))}
          {pctAsistencia !== null && (
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <span className="text-xs font-semibold text-slate-700">{pctAsistencia}%</span>
              <span className="text-[11px] text-slate-400">asistencia</span>
            </div>
          )}
        </div>

        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todas las unidades</option>
          {[1, 2, 3, 4, 5].map((u) => (
            <option key={u} value={u}>Unidad {u}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm font-medium text-slate-500">Sin registros</p>
          <p className="mt-1 text-xs text-slate-400">No hay sesiones registradas para esta selección.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_80px_140px_100px] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Fecha</span>
            <span className="text-center">Unidad</span>
            <span className="text-center">Estado</span>
            <span className="text-center">Acción</span>
          </div>
          <div className="divide-y divide-slate-50">
            {filtradas.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_140px_100px] items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-50/60"
              >
                <span className="text-sm text-slate-700">{formatDateShort(a.fecha)}</span>
                <span className="text-center text-sm text-slate-500">
                  {a.unidad ?? <span className="text-slate-300">—</span>}
                </span>
                <div className="flex justify-center">
                  <EstadoBadge estado={a.estado} />
                </div>
                <div className="flex justify-center">
                  {a.estado === 'FALTA' && (
                    <button
                      onClick={() => setJustModal(a.id)}
                      className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
                    >
                      Justificar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {justModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <h3 className="text-base font-semibold text-slate-900">Justificar falta</h3>
            <p className="mt-1 text-xs text-slate-500">Describe el motivo de tu ausencia. Quedará pendiente de aprobación.</p>
            <textarea
              value={justText}
              onChange={(e) => setJustText(e.target.value)}
              placeholder="Ej. Cita médica, situación familiar..."
              rows={3}
              className="mt-4 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleJustificar}
                disabled={submitting || !justText.trim()}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar justificación'}
              </button>
              <button
                onClick={() => { setJustModal(null); setJustText('') }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
