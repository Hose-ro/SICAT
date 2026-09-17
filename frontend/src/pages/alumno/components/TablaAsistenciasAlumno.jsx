import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { notify } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'
import AttendanceBadge from '../../../components/AttendanceBadge'

const ESTADO_CONFIG = {
  ASISTENCIA:  { label: 'Asistencia',  bg: "bg-success/10", text: "text-success-foreground", ring: "ring-ring", dot: "bg-success" },
  FALTA:       { label: 'Falta',       bg: "bg-destructive/10",    text: "text-destructive-foreground",    ring: "ring-ring",    dot: "bg-destructive"    },
  RETARDO:     { label: 'Retardo',     bg: "bg-warning/10",   text: "text-warning-foreground",   ring: "ring-ring",   dot: "bg-warning/15"   },
  JUSTIFICADA: { label: 'Justificada', bg: "bg-accent",     text: "text-primary-ink",     ring: "ring-ring",     dot: "bg-primary"     },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado]
  if (!cfg) return <span className="text-xs text-muted-foreground">Sin registro</span>
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
      <span className={`text-[11px] ${cfg.text}`}>{cfg.label.toLowerCase()}{count !== 1 ? 's' : ''}</span>
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
  }, [materiaId, obtenerMisAsistencias])

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
      notify('Error al justificar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {asistenciaDeHoy?.estado && (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
          asistenciaDeHoy.estado === 'ASISTENCIA' ? "border-success/30 bg-success/10" :
          asistenciaDeHoy.estado === 'FALTA' ? "border-destructive/30 bg-destructive/10" :
          "border-warning/30 bg-warning/10"
        }`}>
          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTADO_CONFIG[asistenciaDeHoy.estado]?.dot}`} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoy</p>
            <p className="text-sm font-medium text-foreground">
              {ESTADO_CONFIG[asistenciaDeHoy.estado]?.label}
              <span className="ml-2 font-normal text-muted-foreground">
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
            <div className="flex items-center gap-2">
              <AttendanceBadge percentage={pctAsistencia} />
              <span className="text-[11px] text-muted-foreground">asistencia</span>
            </div>
          )}
        </div>

        <select aria-label="Unidad"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">Sin registros</p>
          <p className="mt-1 text-xs text-muted-foreground">No hay sesiones registradas para esta selección.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_80px_140px_100px] gap-2 border-b border-border bg-background px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Fecha</span>
            <span className="text-center">Unidad</span>
            <span className="text-center">Estado</span>
            <span className="text-center">Acción</span>
          </div>
          <div className="divide-y divide-border">
            {filtradas.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_140px_100px] items-center gap-2 px-4 py-3 transition-colors hover:bg-background/60"
              >
                <span className="text-sm text-foreground">{formatDateShort(a.fecha)}</span>
                <span className="text-center text-sm text-muted-foreground">
                  {a.unidad ?? <span className="text-muted-foreground">—</span>}
                </span>
                <div className="flex justify-center">
                  <EstadoBadge estado={a.estado} />
                </div>
                <div className="flex justify-center">
                  {a.estado === 'FALTA' && (
                    <Button variant="ghost"
                      onClick={() => setJustModal(a.id)}
                      className="bg-accent px-3 py-1.5 text-xs font-medium text-primary-ink ring-1 ring-ring  hover:bg-accent"
                    >
                      Justificar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {justModal && (
        <Modal open onClose={() => { setJustModal(null); setJustText('') }} title="Justificar falta" busy={submitting}>
            
            <p className="mt-1 text-xs text-muted-foreground">Describe el motivo de tu ausencia. Quedará pendiente de aprobación.</p>
            <textarea aria-label="Motivo de la ausencia"
              value={justText}
              onChange={(e) => setJustText(e.target.value)}
              placeholder="Ej. Cita médica, situación familiar..."
              rows={3}
              className="mt-4 w-full resize-none rounded-xl border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="default"
                onClick={handleJustificar}
                disabled={submitting || !justText.trim()}
                className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar justificación'}
              </Button>
              <Button variant="outline"
                onClick={() => { setJustModal(null); setJustText('') }}
                className="flex-1 border py-2.5 text-sm font-medium"
              >
                Cancelar
              </Button>
            </div>
          </Modal>
      )}
    </div>
  )
}
