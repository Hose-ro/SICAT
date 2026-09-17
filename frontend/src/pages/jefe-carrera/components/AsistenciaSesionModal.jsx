import Modal from '@/components/Modal'
import { useEffect, useState } from 'react'
import { CalendarClock, MapPin, UserRound, UsersRound, X } from 'lucide-react'
import api from '@/api/axios'

const ESTADO_LABELS = {
  ASISTENCIA: 'Asistencia',
  RETARDO: 'Retardo',
  FALTA: 'Falta',
  JUSTIFICADA: 'Justificada',
}

const ESTADO_STYLES = {
  ASISTENCIA: "border-success/30 bg-success/10 text-success-foreground",
  RETARDO: "border-warning/30 bg-warning/10 text-warning-foreground",
  FALTA: "border-destructive/30 bg-destructive/10 text-destructive-foreground",
  JUSTIFICADA: "border-border bg-accent text-primary-ink",
}

function formatHora(value) {
  if (!value) return '--:--'
  if (typeof value === 'string') return value.slice(0, 5)
  return new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Vista de solo lectura para jefatura de carrera: horario real de la sesión
 * en curso y la lista de asistencia que el docente capturó al iniciarla.
 */
export default function AsistenciaSesionModal({ sesionId, onClose }) {
  // Un solo estado combinado: cada rama del fetch dispara un único setState,
  // evitando los renders en cascada de actualizar loading/error/data por separado.
  const [{ data, loading, error }, setState] = useState({ data: null, loading: true, error: '' })

  useEffect(() => {
    let cancelled = false
    api.get(`/jefe-carrera/sesiones/${sesionId}/asistencia`)
      .then(({ data: response }) => { if (!cancelled) setState({ data: response, loading: false, error: '' }) })
      .catch((requestError) => { if (!cancelled) setState({ data: null, loading: false, error: requestError.response?.data?.message ?? 'No se pudo cargar la asistencia de la sesión' }) })
    return () => { cancelled = true }
  }, [sesionId])

  return (
    <Modal open onClose={onClose} title={data?.sesion?.materia?.nombre ?? 'Clase en curso'} wide><p className="text-sm text-muted-foreground">{data?.sesion?.docente?.nombre} · {data?.sesion?.grupo?.nombre ?? 'Sin grupo'}</p>
        

        <div className="p-5">
          {loading && (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando información de la sesión…</p>
          )}
          {error && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </p>
          )}

          {!loading && !error && data && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile icon={<CalendarClock className="h-4 w-4" />} label="Empezó" value={formatHora(data.sesion.horaInicio)} />
                <InfoTile icon={<CalendarClock className="h-4 w-4" />} label="Finaliza" value={formatHora(data.sesion.horaFinProgramada)} />
                <InfoTile icon={<MapPin className="h-4 w-4" />} label="Aula" value={data.sesion.aula?.nombre ?? 'Sin aula'} />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Pill label="Presentes" value={data.resumen.asistencias} tone="emerald" />
                <Pill label="Retardos" value={data.resumen.retardos} tone="amber" />
                <Pill label="Faltas" value={data.resumen.faltas} tone="rose" />
                <Pill label="Justificadas" value={data.resumen.justificadas} tone="sky" />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UsersRound className="h-4 w-4" /> Lista de asistencia ({data.resumen.total})
                </div>
                {data.asistencias.length ? (
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {data.asistencias.map((alumno) => (
                      <div key={alumno.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{alumno.nombre}</p>
                            <p className="text-xs text-muted-foreground">{alumno.numeroControl ?? 'Sin número de control'}</p>
                          </div>
                        </div>
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[alumno.estado] ?? 'border-border bg-muted text-muted-foreground'}`}>
                          {ESTADO_LABELS[alumno.estado] ?? 'Sin registrar'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    El docente aún no ha tomado asistencia en esta sesión.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
  )
}

function InfoTile({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Pill({ label, value, tone }) {
  const tones = {
    emerald: "bg-success/10 text-success-foreground",
    amber: "bg-warning/10 text-warning-foreground",
    rose: "bg-destructive/10 text-destructive-foreground",
    sky: "bg-accent text-primary-ink",
  }
  return (
    <span className={`rounded-full px-3 py-1 font-semibold ${tones[tone]}`}>
      {label}: {value}
    </span>
  )
}
