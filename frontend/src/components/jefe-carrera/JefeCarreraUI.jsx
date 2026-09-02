import { useEffect } from 'react'
import { AlertCircle, Building2, LoaderCircle } from 'lucide-react'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

export function CarreraSelector({ className = '' }) {
  const { carreras, carreraId, loading, error, cargarCarreras, seleccionarCarrera } = useJefeCarreraStore()

  useEffect(() => {
    if (!carreras.length) cargarCarreras()
  }, [carreras.length, cargarCarreras])

  if (loading && !carreras.length) {
    return <div className="h-10 w-full animate-pulse rounded-xl bg-muted sm:w-64" />
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor="jefe-carrera-selector" className="text-xs font-medium text-muted-foreground">
        Carrera supervisada
      </label>
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          id="jefe-carrera-selector"
          value={carreraId}
          onChange={(event) => seleccionarCarrera(event.target.value)}
          className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-8 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-72"
        >
          {carreras.length > 1 && <option value="">Todas mis carreras</option>}
          {carreras.map((carrera) => (
            <option key={carrera.id} value={carrera.id}>{carrera.codigo} · {carrera.nombre}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function PageState({ loading, error, empty, emptyText = 'No hay información disponible.' }) {
  if (loading) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Cargando información
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert" className="flex min-h-40 items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/10 px-6 text-sm text-destructive">
        <AlertCircle className="mr-2 h-4 w-4" /> {error}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }
  return null
}

const STATE_STYLES = {
  EN_CURSO: 'bg-success/10 text-success border-success/20',
  FINALIZADA: 'bg-muted text-muted-foreground border-border',
  PROGRAMADA: 'bg-primary/10 text-primary border-primary/20',
  PROXIMA: 'bg-primary/10 text-primary border-primary/20',
  NO_INICIADA: 'bg-destructive/10 text-destructive border-destructive/20',
  FUERA_DE_HORARIO: 'bg-warning/15 text-warning-foreground border-warning/30',
  SIN_CLASE: 'bg-muted text-muted-foreground border-border',
  NUEVA: 'bg-destructive/10 text-destructive border-destructive/20',
  REVISADA: 'bg-primary/10 text-primary border-primary/20',
  EN_SEGUIMIENTO: 'bg-warning/15 text-warning-foreground border-warning/30',
  CERRADA: 'bg-success/10 text-success border-success/20',
}

const STATE_LABELS = {
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  PROGRAMADA: 'Programada',
  PROXIMA: 'Próxima',
  NO_INICIADA: 'No iniciada',
  FUERA_DE_HORARIO: 'Fuera de horario',
  SIN_CLASE: 'Sin clase',
  NUEVA: 'Nueva',
  REVISADA: 'Revisada',
  EN_SEGUIMIENTO: 'En seguimiento',
  CERRADA: 'Cerrada',
}

export function StatusBadge({ value }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATE_STYLES[value] ?? STATE_STYLES.SIN_CLASE}`}>
      {STATE_LABELS[value] ?? value}
    </span>
  )
}

export function MetricRow({ items }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 px-5 py-4">
            <dt className="truncate text-xs font-medium text-muted-foreground">{item.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold ${item.tone ?? 'text-foreground'}`}>{item.value}</dd>
            {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
          </div>
        ))}
      </dl>
    </div>
  )
}
