import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, MapPin, Radio, UsersRound } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { CarreraSelector, MetricRow, PageState, StatusBadge } from '@/components/jefe-carrera/JefeCarreraUI'
import AsistenciaSesionModal from './components/AsistenciaSesionModal'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

const INTERVALO_ACTUALIZACION_MS = 20000

function formatHora(value) {
  if (!value) return '--:--'
  if (typeof value === 'string') return value.slice(0, 5)
  return new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function JefeDashboard() {
  const carreraId = useJefeCarreraStore((state) => state.carreraId)
  const [data, setData] = useState(null)
  const [enVivo, setEnVivo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sesionSeleccionada, setSesionSeleccionada] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const [{ data: panel }, { data: docentesEnVivo }] = await Promise.all([
        api.get('/jefe-carrera/panel', { params: carreraId ? { carreraId } : {} }),
        api.get('/jefe-carrera/docentes', { params: { carreraId: carreraId || undefined, estado: 'EN_CURSO' } }),
      ])
      setData(panel)
      setEnVivo(docentesEnVivo)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'No se pudo cargar el panel')
    } finally {
      setLoading(false)
    }
  }, [carreraId])

  useEffect(() => {
    setLoading(true)
    cargar()
    const interval = setInterval(cargar, INTERVALO_ACTUALIZACION_MS)
    return () => clearInterval(interval)
  }, [cargar])

  const state = <PageState loading={loading} error={error} empty={!data} />
  if (loading || error || !data) {
    return <><PageHeader title="Jefatura de carrera" action={<CarreraSelector />} />{state}</>
  }

  const { indicadores } = data
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jefatura de carrera"
        subtitle="Supervisión académica de las carreras bajo tu responsabilidad"
        action={<CarreraSelector />}
      />

      <MetricRow items={[
        { label: 'Docentes activos', value: indicadores.docentesActivos },
        { label: 'Clases de hoy', value: indicadores.clasesHoy, detail: `${indicadores.clasesEnCurso} en curso` },
        { label: 'Asistencia acumulada', value: `${indicadores.asistenciaPromedio}%` },
        { label: 'Alertas abiertas', value: indicadores.alertasAbiertas, tone: indicadores.alertasAbiertas ? 'text-destructive' : 'text-success' },
      ]} />

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Radio className="h-4 w-4 text-success" />
          <h3 className="text-base font-semibold text-foreground">Clases en vivo</h3>
          <span className="ml-auto text-xs text-muted-foreground">Se actualiza automáticamente</span>
        </div>
        {enVivo.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {enVivo.map((docente) => {
              const clase = docente.claseActual
              if (!clase) return null
              return (
                <button
                  key={docente.id}
                  type="button"
                  onClick={() => setSesionSeleccionada(clase.id)}
                  className="rounded-xl border border-success/25 bg-success/5 p-4 text-left transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden="true" /> En línea ahora
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{docente.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {clase.materia?.nombre} · {clase.grupo?.nombre ?? 'Sin grupo'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {formatHora(clase.horaInicio)}–{formatHora(clase.horarioMateria?.horaFin)}</span>
                    {clase.horarioMateria?.aula && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {clase.horarioMateria.aula.nombre}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Ningún docente tiene una clase en curso en este momento.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Clases de hoy</h3>
              <p className="text-sm text-muted-foreground">Estado operativo según horario y sesión registrada</p>
            </div>
            <Link to="/jefe-carrera/clases" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver jornada <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.clases.length ? data.clases.map((clase) => (
              <div key={clase.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{clase.materia.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {clase.docente.nombre} · {clase.grupo?.nombre ?? 'Sin grupo'} · {clase.horaInicio}-{clase.horaFin}
                  </p>
                </div>
                <StatusBadge value={clase.estado} />
              </div>
            )) : <p className="py-10 text-center text-sm text-muted-foreground">No hay clases programadas para hoy.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-base font-semibold text-foreground">Atención requerida</h3>
          <div className="mt-4 space-y-4">
            <AttentionRow icon={<CalendarClock className="h-4 w-4" />} label="Clases con incidencia" value={indicadores.clasesConIncidencia} />
            <AttentionRow icon={<AlertTriangle className="h-4 w-4" />} label="Materias sin horario" value={indicadores.materiasSinHorario} />
            <AttentionRow icon={<UsersRound className="h-4 w-4" />} label="Grupos sin horario" value={indicadores.gruposSinHorario} />
            <AttentionRow icon={<AlertTriangle className="h-4 w-4" />} label="Unidades con más de 28 días" value={indicadores.unidadesAtrasadas} />
          </div>
          <Link to="/jefe-carrera/alertas" className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40">
            Revisar alertas
          </Link>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Docentes</h3>
            <p className="text-sm text-muted-foreground">Carga asignada y estado actual</p>
          </div>
          <Link to="/jefe-carrera/docentes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ver directorio <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-3 font-medium">Docente</th><th className="pb-3 font-medium">Materias</th><th className="pb-3 font-medium">Horarios</th><th className="pb-3 text-right font-medium">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.docentes.map((docente) => (
                <tr key={docente.id}>
                  <td className="py-3 font-medium text-foreground">{docente.nombre}</td>
                  <td className="py-3 text-muted-foreground">{docente.docenteMaterias.length}</td>
                  <td className="py-3 text-muted-foreground">{docente.cargaSemanal}</td>
                  <td className="py-3 text-right"><StatusBadge value={docente.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sesionSeleccionada && (
        <AsistenciaSesionModal sesionId={sesionSeleccionada} onClose={() => setSesionSeleccionada(null)} />
      )}
    </div>
  )
}

function AttentionRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm text-foreground">{label}</p></div>
      <strong className={value ? 'text-destructive' : 'text-success'}>{value}</strong>
    </div>
  )
}
