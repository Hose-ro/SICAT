import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, MapPin, UserRound, UsersRound, X } from 'lucide-react'
import api from '@/api/axios'

const ESTADO_LABELS = {
  ASISTENCIA: 'Asistencia',
  RETARDO: 'Retardo',
  FALTA: 'Falta',
  JUSTIFICADA: 'Justificada',
}

const ESTADO_STYLES = {
  ASISTENCIA: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  RETARDO: 'border-amber-200 bg-amber-100 text-amber-800',
  FALTA: 'border-rose-200 bg-rose-100 text-rose-800',
  JUSTIFICADA: 'border-sky-200 bg-sky-100 text-sky-800',
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

  const cargar = useCallback(async () => {
    setState({ data: null, loading: true, error: '' })
    try {
      const { data: response } = await api.get(`/jefe-carrera/sesiones/${sesionId}/asistencia`)
      setState({ data: response, loading: false, error: '' })
    } catch (requestError) {
      setState({
        data: null,
        loading: false,
        error: requestError.response?.data?.message ?? 'No se pudo cargar la asistencia de la sesión',
      })
    }
  }, [sesionId])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-card p-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden="true" /> En vivo
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
              {data?.sesion?.materia?.nombre ?? 'Clase en curso'}
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {data?.sesion?.docente?.nombre} · {data?.sesion?.grupo?.nombre ?? 'Sin grupo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando información de la sesión…</p>
          )}
          {error && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
      </div>
    </div>
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
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    sky: 'bg-sky-100 text-sky-800',
  }
  return (
    <span className={`rounded-full px-3 py-1 font-semibold ${tones[tone]}`}>
      {label}: {value}
    </span>
  )
}
