import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { useClaseStore } from '../store/claseStore'
import { useAsistenciaStore } from '../store/asistenciaStore'
import AttendanceBadge from '../components/AttendanceBadge'
import AsistenciaSesionPanel from './docente/components/AsistenciaSesionPanel'

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

function formatTime(value) {
  if (!value) return '--:--'
  return value.slice(0, 5)
}

function estadoClaseLabel(estado) {
  switch (estado) {
    case 'EN_CURSO':
      return 'En curso'
    case 'FUERA_DE_HORARIO':
      return 'Fuera de horario'
    case 'PROGRAMADA_AHORA':
      return 'Clase actual'
    case 'FINALIZADA':
      return 'Finalizada'
    case 'PASADA':
      return 'Pendiente'
    case 'PROXIMA':
    default:
      return 'Próxima'
  }
}

function estadoClaseStyle(estado) {
  switch (estado) {
    case 'EN_CURSO':
      return "bg-success/10 text-success-foreground"
    case 'FUERA_DE_HORARIO':
      return "bg-warning/10 text-warning-foreground"
    case 'FINALIZADA':
      return "bg-muted text-foreground"
    case 'PROGRAMADA_AHORA':
      return "bg-accent text-primary-ink"
    case 'PASADA':
      return "bg-destructive/10 text-destructive-foreground"
    case 'PROXIMA':
    default:
      return "bg-accent text-primary-ink"
  }
}

function getApiErrorMessage(error, fallback) {
  const message = error.response?.data?.message

  if (message === 'Forbidden resource') {
    return 'Tu sesión no tiene permisos para realizar esta acción. Cierra sesión, vuelve a ingresar e inténtalo de nuevo.'
  }

  return message || fallback
}

function StatPill({ label, value, tone = 'slate' }) {
  const tones = {
    slate: "bg-muted text-foreground",
    emerald: "bg-success/10 text-success-foreground",
    rose: "bg-destructive/10 text-destructive-foreground",
    amber: "bg-warning/10 text-warning-foreground",
    sky: "bg-accent text-primary-ink",
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {label}: {value}
    </span>
  )
}

function ExportActions({ onExportPdf, onExportExcel, label, disabled = false, ayudaId }) {
  return (
    <div className="flex flex-wrap gap-2">
      {label && (
        <span className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <Button variant="outline"
        type="button"
        onClick={onExportPdf}
        disabled={disabled}
        aria-describedby={ayudaId}
        className="border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Exportar PDF
      </Button>
      <Button variant="default"
        type="button"
        onClick={onExportExcel}
        disabled={disabled}
        aria-describedby={ayudaId}
        className="px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Exportar Excel
      </Button>
    </div>
  )
}

/**
 * Atajo para descargar el acumulado de una materia hasta hoy sin pasar por el
 * filtro fino del historial: entran todas las unidades (aunque sigan
 * abiertas), todas las fechas y, si se elige, un solo grupo.
 */
function ReporteAcumuladoCard({ materias = [], materiaSugeridaId, grupoSugeridoId, onExport }) {
  const [materiaId, setMateriaId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [grupos, setGrupos] = useState([])
  const [gruposLoading, setGruposLoading] = useState(false)
  const [descargando, setDescargando] = useState('')
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const sugerenciaRef = useRef({ materiaId: materiaSugeridaId, grupoId: grupoSugeridoId })
  sugerenciaRef.current = { materiaId: materiaSugeridaId, grupoId: grupoSugeridoId }

  // Preselecciona la materia de la clase en curso (o la primera que imparte)
  // para que el reporte salga con un solo clic.
  useEffect(() => {
    if (materiaId || !materias.length) return
    const sugerida = materias.find((item) => String(item.id) === String(materiaSugeridaId))
    setMateriaId(String((sugerida ?? materias[0]).id))
  }, [materias, materiaSugeridaId, materiaId])

  // Los grupos se consultan aparte para no pisar los del filtro del historial.
  useEffect(() => {
    setGrupos([])
    setGrupoId('')
    if (!materiaId) return undefined

    const id = requestId.current + 1
    requestId.current = id
    setGruposLoading(true)

    api.get('/asistencias/filtros-disponibles', { params: { materiaId } })
      .then((response) => {
        if (id !== requestId.current) return
        const lista = response.data?.grupos ?? []
        setGrupos(lista)
        const sugerencia = sugerenciaRef.current
        const esMateriaSugerida = String(sugerencia.materiaId) === String(materiaId)
        const sugerido = esMateriaSugerida
          ? lista.find((item) => String(item.id) === String(sugerencia.grupoId))
          : null
        if (sugerido) setGrupoId(String(sugerido.id))
        else if (lista.length === 1) setGrupoId(String(lista[0].id))
      })
      .catch(() => {
        if (id === requestId.current) setGrupos([])
      })
      .finally(() => {
        if (id === requestId.current) setGruposLoading(false)
      })

    return undefined
  }, [materiaId])

  const materia = materias.find((item) => String(item.id) === String(materiaId))
  const grupo = grupos.find((item) => String(item.id) === String(grupoId))
  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const resumen = materia
    ? [materia.nombre, grupo ? grupo.nombre : 'todos los grupos', 'todas las unidades', `acumulado al ${hoy}`].join(' · ')
    : 'Elige una materia para descargar el acumulado.'

  const descargar = async (formato) => {
    if (!materiaId || descargando) return
    setDescargando(formato)
    setError('')
    try {
      await onExport(formato, { materiaId, grupoId: grupoId || undefined })
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo generar el reporte acumulado.'))
    } finally {
      setDescargando('')
    }
  }

  return (
    <section
      aria-labelledby="reporte-acumulado-titulo"
      className="rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <h3 id="reporte-acumulado-titulo" className="text-sm font-semibold text-foreground">
              Reporte acumulado hasta hoy
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Todo lo registrado en la materia hasta el momento.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Materia</span>
              <select
                value={materiaId}
                onChange={(event) => setMateriaId(event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground"
              >
                {materias.length === 0 && <option value="">Sin materias asignadas</option>}
                {materias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.clave ? `${item.clave} · ${item.nombre}` : item.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Grupo (opcional)</span>
              <select
                value={grupoId}
                onChange={(event) => setGrupoId(event.target.value)}
                disabled={!materiaId || gruposLoading}
                className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground"
              >
                <option value="">
                  {gruposLoading ? 'Consultando grupos…' : 'Todos los grupos'}
                </option>
                {grupos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}{item.semestre ? ` · ${item.semestre}° semestre` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">{resumen}</p>
          {descargando && (
            <p className="text-xs text-muted-foreground" role="status">
              Generando el reporte en {descargando === 'pdf' ? 'PDF' : 'Excel'}…
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive-foreground">{error}</p>
          )}
        </div>

        <ExportActions
          onExportPdf={() => descargar('pdf')}
          onExportExcel={() => descargar('excel')}
          disabled={!materiaId || Boolean(descargando)}
        />
      </div>
    </section>
  )
}

function ClaseCard({
  clase,
  principal = false,
  onIniciar,
  onTomarAsistencia,
  onFinalizar,
  onIniciarUnidad,
  onFinalizarUnidad,
}) {
  const unidadPendiente = clase?.materia?.unidades?.find((unidad) => unidad.status === 'PENDIENTE')
  const requiereUnidadActiva = !clase.sesion?.id && !clase.unidadActiva
  const inicioAyudaId = `clase-${clase.horarioId}-inicio-ayuda`

  const iniciarLabel = clase.sesion?.id
    ? 'Clase iniciada'
    : requiereUnidadActiva
      ? unidadPendiente
        ? `Inicia ${unidadPendiente.nombre} primero`
        : 'Sin unidad disponible'
      : 'Iniciar clase'

  return (
    <article className={`rounded-3xl border border-border bg-card shadow-sm ${principal ? 'p-6' : 'p-5'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoClaseStyle(clase.estado)}`}>
              {estadoClaseLabel(clase.estado)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {formatTime(clase.horaInicio)} - {formatTime(clase.horaFin)}
            </span>
            {clase.sesion?.fueFueraDeHorario && (
              <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning-foreground">
                Sesión iniciada fuera de horario
              </span>
            )}
          </div>

          <div>
            <h2 className={`${principal ? 'text-2xl' : 'text-lg'} font-semibold text-foreground`}>
              {clase.materia?.nombre}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {clase.grupo?.nombre ?? 'Sin grupo'} · {clase.aula?.nombre ?? 'Aula pendiente'}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Materia: {clase.materia?.clave ?? 'Sin clave'}</p>
            <p>Fecha: {formatDate(new Date())}</p>
            <p>Unidad activa: {clase.unidadActiva?.nombre ?? 'No hay unidad activa'}</p>
            <p>Periodo: {clase.grupo?.periodo ?? 'Sin periodo'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:min-w-[220px]">
          <Button variant="default"
            type="button"
            onClick={onIniciar}
            disabled={Boolean(clase.sesion?.id) || requiereUnidadActiva}
            aria-describedby={requiereUnidadActiva ? inicioAyudaId : undefined}
            className="px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {iniciarLabel}
          </Button>
          {requiereUnidadActiva && (
            <p id={inicioAyudaId} className="px-1 text-xs leading-relaxed text-muted-foreground">
              Activa una unidad para asociar correctamente la asistencia de esta clase.
            </p>
          )}
          <Button variant="outline"
            type="button"
            onClick={onTomarAsistencia}
            disabled={!clase.sesion?.id}
            className="border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tomar asistencia
          </Button>
          <Button variant="destructive"
            type="button"
            onClick={onFinalizar}
            disabled={!clase.sesion?.activa}
            className="border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finalizar clase
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {!clase.unidadActiva && unidadPendiente && (
          <Button variant="ghost"
            type="button"
            onClick={() => onIniciarUnidad(unidadPendiente)}
            className="bg-success/10 px-3 py-2 text-xs font-semibold text-success-foreground  hover:bg-success/15"
          >
            Iniciar {unidadPendiente.nombre}
          </Button>
        )}

        {clase.unidadActiva && (
          <Button variant="ghost"
            type="button"
            onClick={() => onFinalizarUnidad(clase.unidadActiva, clase)}
            className="bg-warning/10 px-3 py-2 text-xs font-semibold text-warning-foreground  hover:bg-warning/15"
          >
            Finalizar {clase.unidadActiva.nombre}
          </Button>
        )}

        <span className="text-xs text-muted-foreground">
          La lista se arma con alumnos del grupo que además tienen inscripción aceptada en la materia.
        </span>
      </div>
    </article>
  )
}

/**
 * Sesiones registradas. Arranca contraída para no saturar la pantalla; el
 * padre la abre al aplicar filtros mediante `abierto` / `onToggle`.
 */
function HistorialTable({ items, onEditar, onExportarPdf, onExportarExcel, abierto = false, onToggle }) {
  const panelId = useId()

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay registros con los filtros actuales.
      </div>
    )
  }

  const ultima = items.reduce((max, item) => (
    !max || new Date(item.fecha) > new Date(max.fecha) ? item : max
  ), null)
  const resumen = `${items.length} ${items.length === 1 ? 'sesión' : 'sesiones'} · última el ${formatDate(ultima?.fecha)}`

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Sesiones registradas</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{resumen}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {abierto ? 'Ocultar' : 'Mostrar'}
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {abierto && (
        <div id={panelId} className="border-t border-border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Clase</span>
            <span>Fecha</span>
            <span>Unidad</span>
            <span>Resumen</span>
            <span>Acciones</span>
          </div>

          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.materia?.nombre}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {item.grupo?.nombre ?? 'Sin grupo'} · {item.aula?.nombre ?? 'Aula pendiente'}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{formatDate(item.fecha)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Semana {item.semanaClave}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.unidad?.nombre ?? 'Sin unidad'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatPill label="A" value={item.resumen?.asistencias ?? 0} tone="emerald" />
                  <StatPill label="F" value={item.resumen?.faltas ?? 0} tone="rose" />
                  <StatPill label="R" value={item.resumen?.retardos ?? 0} tone="amber" />
                  <StatPill label="J" value={item.resumen?.justificados ?? 0} tone="sky" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline"
                    type="button"
                    onClick={() => onEditar(item)}
                    className="border px-3 py-2 text-sm font-medium"
                  >
                    Editar
                  </Button>
                  <Button variant="outline"
                    type="button"
                    onClick={() => onExportarPdf(item)}
                    className="border px-3 py-2 text-sm font-medium"
                  >
                    PDF
                  </Button>
                  <Button variant="default"
                    type="button"
                    onClick={() => onExportarExcel(item)}
                    className="px-3 py-2 text-sm font-medium"
                  >
                    Excel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function formatMesClave(value) {
  const [year, month] = (value || '').split('-').map(Number)
  if (!year || !month) return value
  const etiqueta = new Date(year, month - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)
}

function parseDateKey(value) {
  const [year, month, day] = (value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatSelectedDate(value, week = false) {
  const date = parseDateKey(value)
  if (!date) return ''
  const formatted = date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return week ? `Semana de ${formatted}` : formatted
}

function HistorialDatePicker({
  label,
  value,
  availableDates,
  onChange,
  disabled,
  disabledLabel = 'Sin clases registradas',
  week = false,
  loading = false,
}) {
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const latestDate = availableDates[availableDates.length - 1]
  const initialDate = parseDateKey(value || latestDate) || new Date()
  const [visibleMonth, setVisibleMonth] = useState({
    year: initialDate.getFullYear(),
    month: initialDate.getMonth(),
  })

  useEffect(() => {
    if (!open) return undefined

    const closeOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const firstWeekday = (new Date(visibleMonth.year, visibleMonth.month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(visibleMonth.year, visibleMonth.month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const availableSet = new Set(availableDates)

  const changeMonth = (offset) => {
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.month + offset, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const toggleCalendar = () => {
    if (!open) {
      const reference = parseDateKey(value || latestDate)
      if (reference) {
        setVisibleMonth({ year: reference.getFullYear(), month: reference.getMonth() })
      }
    }
    setOpen((current) => !current)
  }

  const placeholder = loading
    ? 'Consultando clases…'
    : disabled
      ? disabledLabel
      : week
        ? 'Elegir semana'
        : 'Elegir día de clase'

  return (
    <div ref={containerRef} className="relative min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <Button variant="outline"
        type="button"
        onClick={toggleCalendar}
        disabled={disabled || loading}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 border border-input px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{value ? formatSelectedDate(value, week) : placeholder}</span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 z-30 mt-2 w-[calc(100vw-3rem)] max-w-[19rem] rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl shadow-foreground/10"
        >
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost"
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
              className="grid h-9 w-9 place-items-center  text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="text-sm font-semibold">{MESES[visibleMonth.month]} {visibleMonth.year}</p>
            <Button variant="ghost"
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
              className="grid h-9 w-9 place-items-center  text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((weekday, index) => (
              <span key={`${weekday}-${index}`} className="py-1">{weekday}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="h-9" aria-hidden="true" />
              const currentKey = dateKey(visibleMonth.year, visibleMonth.month, day)
              const available = availableSet.has(currentKey)
              const selected = currentKey === value

              return (
                <Button variant="ghost"
                  key={currentKey}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    onChange(currentKey)
                    setOpen(false)
                  }}
                  aria-label={new Date(visibleMonth.year, visibleMonth.month, day).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                  className={`relative grid h-9 place-items-center rounded-xl text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                    selected
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : available
                        ? "bg-primary/10 font-semibold text-primary-ink hover:bg-primary hover:text-primary-foreground"
                        : 'cursor-default text-muted-foreground/45'
                  }`}
                >
                  {day}
                  {available && !selected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </Button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[11px] leading-4 text-muted-foreground">Sólo se marcan días con clase impartida.</p>
            {value && (
              <Button variant="ghost"
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="shrink-0 text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FiltroToolbar({
  filters,
  onChange,
  onApply,
  materias = [],
  grupos = [],
  unidades = [],
  docentes = [],
  showDocente = false,
  fechasClase = null,
  mesesClase = [],
  gruposLoading = false,
  fechasLoading = false,
  gruposRestringidos = false,
}) {
  const grupoDisabled = gruposRestringidos && (
    !filters.materiaId || gruposLoading || grupos.length === 0
  )

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {showDocente && (
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Docente</span>
            <select
              value={filters.docenteId}
              onChange={(event) => onChange('docenteId', event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground"
            >
              <option value="">Todos los docentes</option>
              {docentes.map((docente) => (
                <option key={docente.id} value={docente.id}>{docente.nombre}</option>
              ))}
            </select>
          </label>
        )}

        <label className="min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Materia</span>
          <select
            value={filters.materiaId}
            onChange={(event) => onChange('materiaId', event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground"
          >
            <option value="">
              {materias.length === 0 ? 'Sin materias asignadas' : 'Todas las materias'}
            </option>
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.clave ? `${materia.clave} · ${materia.nombre}` : materia.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Grupo</span>
          <select
            value={filters.grupoId}
            onChange={(event) => onChange('grupoId', event.target.value)}
            disabled={grupoDisabled}
            className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground"
          >
            <option value="">
              {gruposRestringidos && !filters.materiaId
                ? 'Selecciona una materia'
                : gruposLoading
                  ? 'Consultando grupos…'
                  : gruposRestringidos && grupos.length === 0
                    ? 'Sin grupos compatibles'
                    : gruposRestringidos
                      ? 'Todos los grupos compatibles'
                      : 'Todos los grupos'}
            </option>
            {grupos.map((grupo) => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.nombre}{grupo.semestre ? ` · ${grupo.semestre}° semestre` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Unidad</span>
          <select
            value={filters.unidadId}
            onChange={(event) => onChange('unidadId', event.target.value)}
            disabled={!filters.materiaId}
            className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground"
          >
            <option value="">{filters.materiaId ? 'Todas las unidades' : 'Selecciona una materia'}</option>
            {unidades.map((unidad) => (
              <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
            ))}
          </select>
        </label>

        {Array.isArray(fechasClase) ? (
          <>
            <HistorialDatePicker
              label="Fecha de clase"
              value={filters.fecha}
              availableDates={fechasClase}
              onChange={(value) => onChange('fecha', value)}
              disabled={!filters.materiaId || fechasClase.length === 0}
              disabledLabel={filters.materiaId ? 'Sin clases registradas' : 'Selecciona una materia'}
              loading={fechasLoading}
            />
            <HistorialDatePicker
              label="Semana de clase"
              value={filters.semana}
              availableDates={fechasClase}
              onChange={(value) => onChange('semana', value)}
              disabled={!filters.materiaId || fechasClase.length === 0}
              disabledLabel={filters.materiaId ? 'Sin clases registradas' : 'Selecciona una materia'}
              loading={fechasLoading}
              week
            />
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Mes de clase</span>
              <select
                value={filters.mes}
                onChange={(event) => onChange('mes', event.target.value)}
                disabled={!filters.materiaId || mesesClase.length === 0}
                className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground"
              >
                <option value="">
                  {!filters.materiaId
                    ? 'Selecciona una materia'
                    : mesesClase.length === 0
                      ? 'Sin clases registradas'
                      : 'Todos los meses'}
                </option>
                {mesesClase.map((mes) => (
                  <option key={mes} value={mes}>{formatMesClave(mes)}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha</span>
              <input
                type="date"
                value={filters.fecha}
                onChange={(event) => onChange('fecha', event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-border px-4 py-3 text-sm text-foreground"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Semana</span>
              <input
                type="date"
                value={filters.semana}
                onChange={(event) => onChange('semana', event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-border px-4 py-3 text-sm text-foreground"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Mes</span>
              <input
                type="month"
                value={filters.mes}
                onChange={(event) => onChange('mes', event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-border px-4 py-3 text-sm text-foreground"
              />
            </label>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="default"
          type="button"
          onClick={onApply}
          className="px-4 py-3 text-sm font-semibold"
        >
          Aplicar filtros
        </Button>
        <span className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          Fecha, semana y mes se excluyen entre sí. Para la semana, elige cualquier fecha de esa semana.
        </span>
      </div>
    </div>
  )
}

function AttendanceBar({ percentage }) {
  const pct = Math.min(100, Math.max(0, percentage ?? 0))
  const color =
    pct >= 85 ? "bg-success" :
    pct >= 70 ? "bg-warning/15" :
    "bg-destructive"

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-[color,background-color,border-color,opacity,transform] duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MiniStat({ label, value, color = "text-foreground" }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className={`text-base font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

function AlumnoMateriaCard({ item }) {
  const { materia, grupo, resumen, ultimaSesion } = item
  const pct = resumen.porcentaje ?? 0

  const detalleGrupo = grupo
    ? `${grupo.nombre} · ${grupo.periodo}`
    : materia.carrera
      ? `${materia.carrera.nombre}${materia.semestre ? ` · Sem. ${materia.semestre}` : ''}`
      : 'Sin grupo asignado'

  const statusMsg =
    (resumen.totalSesiones ?? 0) === 0
      ? null
      : (resumen.sinRegistro ?? 0) > 0
        ? { text: `${resumen.sinRegistro} sesión(es) aún sin captura`, warn: true }
        : { text: 'Todos los registros al día', warn: false }

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                {materia.clave}
              </span>
            </div>
            <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2">
              {materia.nombre}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground truncate">{detalleGrupo}</p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {materia.docente?.nombre ?? 'Docente por asignar'}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <AttendanceBadge percentage={pct} />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {resumen.totalSesiones ?? 0} sesiones
            </span>
          </div>
        </div>

        <div className="mt-4">
          <AttendanceBar percentage={pct} />
        </div>

        <div className="mt-4 grid grid-cols-4 divide-x divide-border rounded-xl bg-background py-3">
          <MiniStat label="Asist." value={resumen.asistencias ?? 0} color="text-success-foreground" />
          <MiniStat label="Faltas" value={resumen.faltas ?? 0} color="text-destructive-foreground" />
          <MiniStat label="Retard." value={resumen.retardos ?? 0} color="text-warning-foreground" />
          <MiniStat label="Justif." value={resumen.justificados ?? 0} color="text-primary-ink" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-background/60 px-5 py-3">
        <div className="min-w-0">
          {statusMsg ? (
            <p className={`text-xs truncate ${statusMsg.warn ? "text-warning-foreground" : "text-success-foreground"}`}>
              {statusMsg.warn ? '⚠ ' : '✓ '}{statusMsg.text}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Última clase: {formatDate(ultimaSesion)}</p>
          )}
          {statusMsg && (
            <p className="text-[11px] text-muted-foreground mt-0.5">Última clase: {formatDate(ultimaSesion)}</p>
          )}
        </div>
        <Link
          to={`/alumno/materias/${materia.id}`}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary"
        >
          Ver detalle →
        </Link>
      </div>
    </article>
  )
}

function AlumnoAsistenciasView() {
  const [resumen, setResumen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const cargarResumen = async (silent = false) => {
      if (!silent) setLoading(true)

      try {
        const response = await api.get('/asistencias/mis-resumen')
        if (!active) return
        setResumen(Array.isArray(response.data) ? response.data : [])
        setError('')
      } catch (err) {
        if (!active) return
        setError(err.response?.data?.message || 'No se pudo cargar tu resumen de asistencias.')
      } finally {
        if (active && !silent) setLoading(false)
      }
    }

    cargarResumen()
    const interval = setInterval(() => {
      cargarResumen(true).catch(() => {})
    }, 30000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const estadisticas = resumen.reduce((acc, item) => {
    acc.materias++
    acc.asistencias += item.resumen?.asistencias ?? 0
    acc.faltas += item.resumen?.faltas ?? 0
    acc.retardos += item.resumen?.retardos ?? 0
    acc.justificados += item.resumen?.justificados ?? 0
    acc.sinRegistro += item.resumen?.sinRegistro ?? 0
    acc.totalSesiones += item.resumen?.totalSesiones ?? 0
    return acc
  }, {
    materias: 0,
    asistencias: 0,
    faltas: 0,
    retardos: 0,
    justificados: 0,
    sinRegistro: 0,
    totalSesiones: 0,
  })

  const totalRegistrado = (
    estadisticas.asistencias +
    estadisticas.faltas +
    estadisticas.retardos +
    estadisticas.justificados
  )
  const porcentajeGlobal = totalRegistrado > 0
    ? Math.round((estadisticas.asistencias / totalRegistrado) * 100)
    : 0

  const pctColor =
    porcentajeGlobal >= 85 ? "text-success-foreground" :
    porcentajeGlobal >= 70 ? "text-warning-foreground" :
    "text-destructive-foreground"

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Panel del alumno</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis asistencias</h1>
        <p className="text-sm text-muted-foreground">
          Consulta tu avance por materia e identifica faltas antes de que afecten tu evaluación.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          <span className="mt-0.5 shrink-0 text-destructive-foreground">⚠</span>
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Materias</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-foreground">{estadisticas.materias}</p>
          <p className="mt-1 text-xs text-muted-foreground">inscritas este periodo</p>
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/10 p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-success-foreground">Asistencias</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-success-foreground">{estadisticas.asistencias}</p>
          <p className="mt-1 text-xs text-success-foreground">presencias registradas</p>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive-foreground">Faltas</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-destructive-foreground">{estadisticas.faltas}</p>
          <p className="mt-1 text-xs text-destructive-foreground">ausencias acumuladas</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">% Global</p>
          <p className={`mt-3 text-4xl font-bold tabular-nums ${pctColor}`}>{porcentajeGlobal}%</p>
          <div className="mt-2">
            <AttendanceBar percentage={porcentajeGlobal} />
          </div>
        </div>
      </section>

      {!loading && resumen.length > 0 && (estadisticas.retardos > 0 || estadisticas.justificados > 0 || estadisticas.sinRegistro > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {estadisticas.retardos > 0 && (
            <span className="rounded-full bg-warning/10 px-3 py-1.5 font-medium text-warning-foreground ring-1 ring-ring">
              {estadisticas.retardos} retardo{estadisticas.retardos !== 1 ? 's' : ''}
            </span>
          )}
          {estadisticas.justificados > 0 && (
            <span className="rounded-full bg-accent px-3 py-1.5 font-medium text-primary-ink ring-1 ring-ring">
              {estadisticas.justificados} justificado{estadisticas.justificados !== 1 ? 's' : ''}
            </span>
          )}
          {estadisticas.sinRegistro > 0 && (
            <span className="rounded-full bg-muted px-3 py-1.5 font-medium text-muted-foreground ring-1 ring-ring">
              {estadisticas.sinRegistro} sin captura
            </span>
          )}
          <span className="rounded-full bg-muted px-3 py-1.5 font-medium text-muted-foreground ring-1 ring-ring">
            {estadisticas.totalSesiones} sesiones totales
          </span>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Por materia</h2>
        {loading ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-52 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : resumen.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">Sin materias disponibles</p>
            <p className="mt-1 text-xs text-muted-foreground">No hay sesiones registradas en este momento.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {resumen.map((item) => (
              <AlumnoMateriaCard key={item.materia.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function formatFechaClave(value) {
  const date = parseDateKey(value)
  if (!date) return value
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function describirFiltro(filters, { materias = [], grupos = [], unidades = [] }) {
  const partes = []
  const materia = materias.find((item) => String(item.id) === String(filters.materiaId))
  if (materia) partes.push(materia.nombre)
  const grupo = grupos.find((item) => String(item.id) === String(filters.grupoId))
  if (grupo) partes.push(grupo.nombre)
  const unidad = unidades.find((item) => String(item.id) === String(filters.unidadId))
  if (unidad) partes.push(unidad.nombre)

  if (filters.fecha) partes.push(formatFechaClave(filters.fecha))
  else if (filters.semana) partes.push(`Semana del ${formatFechaClave(filters.semana)}`)
  else if (filters.mes) partes.push(formatMesClave(filters.mes))

  if (!partes.length) return 'Todo el historial disponible'
  if (!filters.fecha && !filters.semana && !filters.mes) {
    partes.push('todas las fechas')
  }
  return partes.join(' · ')
}

function claveAtrasada(item) {
  return `${item.horarioId}-${item.fecha}`
}

/**
 * Clases del horario que ya pasaron dentro de una unidad iniciada y siguen sin
 * pase de lista. Sólo estas fechas se pueden capturar de forma atrasada.
 */
function ClasesAtrasadasSection({
  items,
  loading,
  error,
  procesando,
  onCapturar,
  onMarcarTodas,
  marcandoLote,
}) {
  const [abierta, setAbierta] = useState(true)
  const [seleccion, setSeleccion] = useState([])
  const [confirmando, setConfirmando] = useState(false)

  // Sólo se puede capturar lo que tiene unidad a la que asociarse.
  const capturables = items.filter((item) => item.unidad)
  const clavesCapturables = capturables.map(claveAtrasada)

  // Si el listado cambia (por ejemplo tras guardar), se descartan las
  // selecciones de clases que ya no están pendientes.
  useEffect(() => {
    setSeleccion((prev) => prev.filter((clave) => clavesCapturables.includes(clave)))
    setConfirmando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavesCapturables.join('|')])

  const alternar = (clave) => {
    setConfirmando(false)
    setSeleccion((prev) =>
      prev.includes(clave) ? prev.filter((item) => item !== clave) : [...prev, clave],
    )
  }

  const todasSeleccionadas =
    clavesCapturables.length > 0 && seleccion.length === clavesCapturables.length

  const alternarTodas = () => {
    setConfirmando(false)
    setSeleccion(todasSeleccionadas ? [] : clavesCapturables)
  }

  const confirmarLote = async () => {
    const elegidas = capturables.filter((item) => seleccion.includes(claveAtrasada(item)))
    if (!elegidas.length) return
    await onMarcarTodas(elegidas)
    setSeleccion([])
    setConfirmando(false)
  }

  const grupos = []
  items.forEach((item) => {
    const clave = `${item.materiaId}-${item.grupoId ?? 'sin-grupo'}`
    let grupo = grupos.find((entry) => entry.clave === clave)
    if (!grupo) {
      grupo = { clave, materia: item.materia, grupo: item.grupo, clases: [] }
      grupos.push(grupo)
    }
    grupo.clases.push(item)
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">Asistencias atrasadas</h2>
            {items.length > 0 && (
              <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning-foreground">
                {items.length} pendiente{items.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Clases de tu horario que ya ocurrieron en este periodo y quedaron sin lista.
          </p>
        </div>

        {items.length > 0 && (
          <Button variant="outline"
            type="button"
            onClick={() => setAbierta((prev) => !prev)}
            className="self-start border px-3 py-2 text-sm font-medium"
          >
            {abierta ? 'Ocultar' : 'Ver pendientes'}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Revisando tu horario...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No tienes asistencias atrasadas: todas las clases de tu horario ya tienen lista.
        </div>
      ) : (
        abierta && (
          <>
            {capturables.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      onChange={alternarTodas}
                      className="size-4 rounded border-border"
                    />
                    <span>
                      Seleccionar todas
                      <span className="ml-2 text-xs text-muted-foreground">
                        {seleccion.length} de {capturables.length} elegidas
                      </span>
                    </span>
                  </label>

                  <Button variant="default"
                    type="button"
                    onClick={() => setConfirmando(true)}
                    disabled={seleccion.length === 0 || marcandoLote || confirmando}
                    className="px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Marcar asistencia a todos
                  </Button>
                </div>

                {confirmando && (
                  <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-warning-foreground">
                      Se marcará <strong>asistencia</strong> a todos los alumnos en {seleccion.length}{' '}
                      clase{seleccion.length === 1 ? '' : 's'}. Después puedes abrir cualquiera y ajustar casos sueltos.
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline"
                        type="button"
                        onClick={() => setConfirmando(false)}
                        disabled={marcandoLote}
                        className="border px-3 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        Cancelar
                      </Button>
                      <Button variant="default"
                        type="button"
                        onClick={confirmarLote}
                        disabled={marcandoLote}
                        className="px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {marcandoLote ? 'Marcando...' : 'Sí, marcar asistencia'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              {grupos.map((entry) => (
                <article key={entry.clave} className="rounded-3xl border border-border bg-muted/40 p-5">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{entry.materia?.nombre}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.grupo?.nombre ?? 'Sin grupo'} · {entry.materia?.clave ?? 'Sin clave'}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {entry.clases.map((item) => {
                      const clave = claveAtrasada(item)
                      const enProceso = procesando === clave
                      // Sin unidad iniciada no hay a qué asociar la asistencia.
                      const sinUnidad = !item.unidad
                      const ayudaId = sinUnidad ? `atrasada-${clave}-ayuda` : undefined
                      return (
                        <li
                          key={clave}
                          className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <input
                              type="checkbox"
                              checked={seleccion.includes(clave)}
                              onChange={() => alternar(clave)}
                              disabled={sinUnidad || marcandoLote}
                              aria-label={`Seleccionar la clase del ${formatFechaClave(item.fecha)}`}
                              className="mt-1 size-4 shrink-0 rounded border-border disabled:opacity-40"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium capitalize text-foreground">
                                {formatFechaClave(item.fecha)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatTime(item.horaInicio)} - {formatTime(item.horaFin)}
                                {item.unidad ? ` · ${item.unidad.nombre}` : ' · sin unidad iniciada'}
                                {item.estado === 'SIN_CAPTURA' && ' · sesión abierta sin lista'}
                              </p>
                              {sinUnidad && (
                                <p id={ayudaId} className="mt-1 text-xs leading-relaxed text-warning-foreground">
                                  Inicia una unidad de la materia para poder capturar esta lista.
                                </p>
                              )}
                            </div>
                          </div>

                          <Button variant="default"
                            type="button"
                            onClick={() => onCapturar(item)}
                            disabled={enProceso || sinUnidad || marcandoLote}
                            aria-describedby={ayudaId}
                            className="shrink-0 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {enProceso ? 'Abriendo...' : 'Capturar asistencia'}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </>
        )
      )}
    </section>
  )
}


function DocenteAsistenciasView() {
  const navigate = useNavigate()
  const {
    panelDocente,
    cargarPanelDocente,
    clasesAtrasadas,
    cargarClasesAtrasadas,
    registrarClaseAtrasada,
    marcarAsistenciaAtrasadas,
    iniciar,
    finalizar,
  } = useClaseStore()
  const { historial, estadisticas, obtenerHistorial, exportar } = useAsistenciaStore()
  const { user } = useAuthStore()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [exportSuggestion, setExportSuggestion] = useState(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [filters, setFilters] = useState({
    materiaId: '',
    grupoId: '',
    unidadId: '',
    fecha: '',
    semana: '',
    mes: '',
  })
  const [opcionesFiltros, setOpcionesFiltros] = useState({
    materias: [],
    grupos: [],
    unidades: [],
    fechasClase: [],
    mesesClase: [],
  })
  const [opcionesLoading, setOpcionesLoading] = useState(false)
  const [opcionesError, setOpcionesError] = useState('')
  const [atrasadasLoading, setAtrasadasLoading] = useState(true)
  const [atrasadasError, setAtrasadasError] = useState('')
  const [atrasadaProcesando, setAtrasadaProcesando] = useState('')
  const [marcandoLote, setMarcandoLote] = useState(false)
  const opcionesRequestId = useRef(0)
  const panelCapturaRef = useRef(null)

  const cargarOpcionesFiltros = async (materiaId, grupoId = '') => {
    if (!materiaId) return null

    const requestId = opcionesRequestId.current + 1
    opcionesRequestId.current = requestId
    setOpcionesLoading(true)
    setOpcionesError('')

    try {
      const response = await api.get('/asistencias/filtros-disponibles', {
        params: {
          materiaId,
          ...(grupoId ? { grupoId } : {}),
        },
      })
      if (requestId === opcionesRequestId.current) {
        setOpcionesFiltros(response.data)
      }
      return response.data
    } catch (error) {
      if (requestId === opcionesRequestId.current) {
        setOpcionesFiltros((current) => ({
          ...current,
          grupos: [],
          fechasClase: [],
          mesesClase: [],
        }))
        setOpcionesError(getApiErrorMessage(error, 'No se pudieron comprobar los grupos y fechas de esta materia.'))
      }
      return null
    } finally {
      if (requestId === opcionesRequestId.current) setOpcionesLoading(false)
    }
  }

  const cargarAtrasadas = useCallback(async () => {
    setAtrasadasLoading(true)
    try {
      await cargarClasesAtrasadas()
      setAtrasadasError('')
    } catch (error) {
      setAtrasadasError(getApiErrorMessage(error, 'No se pudieron revisar tus clases sin asistencia.'))
    } finally {
      setAtrasadasLoading(false)
    }
  }, [cargarClasesAtrasadas])

  const cargarTodo = async (nextFilters = filters) => {
    const requests = [
      cargarPanelDocente(),
      obtenerHistorial(nextFilters),
      cargarAtrasadas(),
    ]
    if (nextFilters.materiaId) {
      requests.push(cargarOpcionesFiltros(nextFilters.materiaId, nextFilters.grupoId))
    }
    await Promise.all(requests)
  }

  useEffect(() => {
    Promise.all([
      cargarPanelDocente(),
      obtenerHistorial({}),
      cargarAtrasadas(),
    ]).catch(() => {})

    const requestId = opcionesRequestId.current + 1
    opcionesRequestId.current = requestId
    api.get('/asistencias/filtros-disponibles')
      .then((response) => {
        if (requestId !== opcionesRequestId.current) return
        setOpcionesFiltros(response.data)
        setOpcionesError('')
      })
      .catch((error) => {
        if (requestId !== opcionesRequestId.current) return
        setOpcionesError(getApiErrorMessage(error, 'No se pudieron cargar las opciones del historial.'))
      })

    const interval = setInterval(() => {
      cargarPanelDocente().catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [cargarPanelDocente, obtenerHistorial, cargarAtrasadas])

  const clasesHoy = panelDocente?.clasesHoy ?? []
  const clasePrincipal = panelDocente?.claseActual ?? panelDocente?.proximaClase ?? null

  const materias = opcionesFiltros.materias ?? []
  const grupos = opcionesFiltros.grupos ?? []
  const fechasClase = opcionesFiltros.fechasClase ?? []
  const mesesClase = opcionesFiltros.mesesClase ?? []
  const unidades = opcionesFiltros.unidades ?? []
  const resumenFiltro = describirFiltro(filters, { materias, grupos, unidades })

  const handleStartClass = async (clase) => {
    setMensaje('')

    if (!clase?.unidadActiva) {
      const unidadPendiente = clase?.materia?.unidades?.find((unidad) => unidad.status === 'PENDIENTE')
      setMensaje(
        unidadPendiente
          ? `Primero inicia ${unidadPendiente.nombre}; después podrás iniciar la clase.`
          : 'No hay una unidad disponible para iniciar esta clase.',
      )
      return
    }

    try {
      const response = await iniciar({ horarioId: clase.horarioId })
      setSelectedSessionId(response.id)
      if (response.advertencia) setMensaje(response.advertencia)
      await cargarTodo()
    } catch (error) {
      setMensaje(getApiErrorMessage(error, 'No se pudo iniciar la clase.'))
    }
  }

  const handleFinalizeClass = useAsyncAction(async (clase) => {
    if (!clase?.sesion?.id) return
    if (!(await confirmAction({ title: 'Finalizar clase', description: 'La clase se cerrará y los alumnos sin captura quedarán como falta. Comprueba la lista antes de continuar.', confirmLabel: 'Finalizar clase' }))) return

    setMensaje('')
    try {
      await finalizar(clase.sesion.id)
      setExportSuggestion({
        type: 'clase',
        materiaId: clase.materiaId,
        sesionId: clase.sesion.id,
        label: 'La clase se cerró. Puedes descargar el reporte del día.',
      })
      await cargarTodo()
    } catch (error) {
      setMensaje(error.response?.data?.message || 'No se pudo finalizar la clase.')
    }
  })

  const handleIniciarUnidad = async (unidad) => {
    setMensaje('')
    try {
      await api.patch(`/unidades/${unidad.id}/iniciar`)
      await cargarTodo()
      setMensaje(`${unidad.nombre} está activa. Ya puedes iniciar la clase.`)
    } catch (error) {
      setMensaje(getApiErrorMessage(error, 'No se pudo iniciar la unidad.'))
    }
  }

  const handleFinalizarUnidad = async (unidad, clase) => {
    if (!unidad?.id) return
    setMensaje('')
    try {
      await api.patch(`/unidades/${unidad.id}/finalizar`)
      if (clase?.materiaId) {
        setExportSuggestion({
          type: 'unidad',
          materiaId: clase.materiaId,
          unidadId: unidad.id,
          label: `La ${unidad.nombre} finalizó. Puedes exportar el acumulado de la unidad.`,
        })
      }
      await cargarTodo()
    } catch (error) {
      setMensaje(error.response?.data?.message || 'No se pudo finalizar la unidad.')
    }
  }

  const handleCapturarAtrasada = async (item) => {
    const clave = claveAtrasada(item)
    setMensaje('')
    setAtrasadaProcesando(clave)

    try {
      let sesionId = item.sesion?.id
      if (!sesionId) {
        const sesion = await registrarClaseAtrasada({
          horarioId: item.horarioId,
          fecha: item.fecha,
        })
        sesionId = sesion.id
      }

      setSelectedSessionId(sesionId)
      setMensaje(
        `Captura la lista del ${formatFechaClave(item.fecha)}. Se guardará con la fecha real de la clase.`,
      )
      await cargarTodo()
      panelCapturaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (error) {
      setMensaje(getApiErrorMessage(error, 'No se pudo abrir la clase atrasada.'))
    } finally {
      setAtrasadaProcesando('')
    }
  }

  const handleMarcarAtrasadas = async (elegidas) => {
    setMensaje('')
    setMarcandoLote(true)
    try {
      const resultado = await marcarAsistenciaAtrasadas(elegidas)
      const partes = [
        `Se marcó asistencia a ${resultado.alumnosMarcados} alumno${resultado.alumnosMarcados === 1 ? '' : 's'} en ${resultado.procesadas.length} clase${resultado.procesadas.length === 1 ? '' : 's'}.`,
      ]
      if (resultado.omitidas.length) {
        partes.push(
          `${resultado.omitidas.length} se omitieron: ${resultado.omitidas[0].motivo}.`,
        )
      }
      setMensaje(partes.join(' '))
      await cargarTodo()
    } catch (error) {
      setMensaje(getApiErrorMessage(error, 'No se pudo marcar la asistencia de las clases elegidas.'))
    } finally {
      setMarcandoLote(false)
    }
  }

  const applyFilters = () => {
    setHistorialAbierto(true)
    return cargarTodo(filters)
  }

  // Exporta el conjunto filtrado completo, no una sola sesión.
  const exportarFiltrado = (formato) => {
    if (!filters.materiaId) return
    return exportar(filters.materiaId, {
      formato,
      grupoId: filters.grupoId || undefined,
      unidadId: filters.unidadId || undefined,
      fecha: filters.fecha || undefined,
      semana: filters.semana || undefined,
      mes: filters.mes || undefined,
    })
  }

  const abrirPaseDeLista = (sesionId) => {
    if (!sesionId) {
      setMensaje('Primero debes iniciar la clase para poder tomar asistencia.')
      return
    }
    navigate(`/docente/pasar-lista/${sesionId}`)
  }

  const handleFilterChange = (key, value) => {
    if (key === 'materiaId') {
      opcionesRequestId.current += 1
      setOpcionesLoading(Boolean(value))
      setOpcionesError('')
      setOpcionesFiltros((current) => ({
        ...current,
        grupos: [],
        unidades: [],
        fechasClase: [],
        mesesClase: [],
      }))
      if (value) {
        cargarOpcionesFiltros(value)
      }
    } else if (key === 'grupoId') {
      opcionesRequestId.current += 1
      setOpcionesFiltros((current) => ({ ...current, fechasClase: [], mesesClase: [] }))
      cargarOpcionesFiltros(filters.materiaId, value)
    }

    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fecha' && value) {
        next.semana = ''
        next.mes = ''
      }
      if (key === 'semana' && value) {
        next.fecha = ''
        next.mes = ''
      }
      if (key === 'mes' && value) {
        next.fecha = ''
        next.semana = ''
      }
      if (key === 'materiaId') {
        next.grupoId = ''
        next.unidadId = ''
        next.fecha = ''
        next.semana = ''
        next.mes = ''
      }
      if (key === 'grupoId') {
        next.fecha = ''
        next.semana = ''
        next.mes = ''
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Asistencia docente</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          La pantalla prioriza tu horario real del día. Inicia la clase, captura la lista del grupo y materia correctos, y edita el historial cuando sea necesario.
        </p>
      </header>

      {mensaje && (
        <div className="rounded-3xl border border-warning/30 bg-warning/10 px-5 py-4 text-sm text-warning-foreground">
          {mensaje}
        </div>
      )}

      {exportSuggestion && (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">{exportSuggestion.label}</p>
            <ExportActions
              label={exportSuggestion.type === 'unidad' ? 'Reporte de unidad' : 'Reporte de clase'}
              onExportPdf={() => exportar(exportSuggestion.materiaId, {
                formato: 'pdf',
                sesionId: exportSuggestion.sesionId,
                unidadId: exportSuggestion.unidadId,
              })}
              onExportExcel={() => exportar(exportSuggestion.materiaId, {
                formato: 'excel',
                sesionId: exportSuggestion.sesionId,
                unidadId: exportSuggestion.unidadId,
              })}
            />
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Clase actual</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Docente: {user?.nombre}
          </span>
        </div>

        {clasePrincipal ? (
          <ClaseCard
            principal
            clase={clasePrincipal}
            onIniciar={() => handleStartClass(clasePrincipal)}
            onTomarAsistencia={() => abrirPaseDeLista(clasePrincipal.sesion?.id)}
            onFinalizar={() => handleFinalizeClass(clasePrincipal)}
            onIniciarUnidad={handleIniciarUnidad}
            onFinalizarUnidad={handleFinalizarUnidad}
          />
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No tienes clases programadas para hoy.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Mis clases de hoy</h2>
          <Button variant="outline"
            type="button"
            onClick={() => cargarTodo()}
            className="border px-3 py-2 text-sm font-medium"
          >
            Actualizar
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {clasesHoy.map((clase) => (
            <ClaseCard
              key={`${clase.horarioId}-${clase.grupoId ?? 'sin-grupo'}`}
              clase={clase}
              onIniciar={() => handleStartClass(clase)}
              onTomarAsistencia={() => abrirPaseDeLista(clase.sesion?.id)}
              onFinalizar={() => handleFinalizeClass(clase)}
              onIniciarUnidad={handleIniciarUnidad}
              onFinalizarUnidad={handleFinalizarUnidad}
            />
          ))}
        </div>
      </section>

      <ClasesAtrasadasSection
        items={clasesAtrasadas ?? []}
        loading={atrasadasLoading}
        error={atrasadasError}
        procesando={atrasadaProcesando}
        onCapturar={handleCapturarAtrasada}
        onMarcarTodas={handleMarcarAtrasadas}
        marcandoLote={marcandoLote}
      />

      <section ref={panelCapturaRef} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Toma de asistencia</h2>
          {selectedSessionId && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Sesión #{selectedSessionId}
            </span>
          )}
        </div>

        <AsistenciaSesionPanel
          sesionId={selectedSessionId}
          onSaved={() => {
            cargarTodo()
            if (filters.materiaId) obtenerHistorial(filters)
          }}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Historial y reportes</h2>
          </div>

          {estadisticas && (
            <div className="flex flex-wrap gap-2">
              <StatPill label="A" value={estadisticas.asistencias} tone="emerald" />
              <StatPill label="F" value={estadisticas.faltas} tone="rose" />
              <StatPill label="R" value={estadisticas.retardos} tone="amber" />
              <StatPill label="J" value={estadisticas.justificados} tone="sky" />
              <StatPill label="%" value={`${estadisticas.porcentaje ?? 0}%`} />
            </div>
          )}
        </div>

        <ReporteAcumuladoCard
          materias={materias}
          materiaSugeridaId={clasePrincipal?.materiaId}
          grupoSugeridoId={clasePrincipal?.grupoId}
          onExport={(formato, { materiaId, grupoId }) => exportar(materiaId, { formato, grupoId })}
        />

        <FiltroToolbar
          filters={filters}
          onChange={handleFilterChange}
          onApply={applyFilters}
          materias={materias}
          grupos={grupos}
          unidades={unidades}
          fechasClase={fechasClase}
          mesesClase={mesesClase}
          gruposLoading={opcionesLoading}
          fechasLoading={opcionesLoading}
          gruposRestringidos
        />

        <div className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Reporte de lo filtrado</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{resumenFiltro}</p>
            {!filters.materiaId && (
              <p id="export-filtrado-ayuda" className="mt-1 text-xs text-muted-foreground">
                Elige una materia para poder guardar el reporte.
              </p>
            )}
          </div>
          <ExportActions
            onExportPdf={() => exportarFiltrado('pdf')}
            onExportExcel={() => exportarFiltrado('excel')}
            disabled={!filters.materiaId}
            ayudaId={!filters.materiaId ? 'export-filtrado-ayuda' : undefined}
          />
        </div>

        {opcionesError && (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {opcionesError}
          </p>
        )}

        {estadisticas?.rankingFaltas?.length > 0 && (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5">
            <h3 className="text-sm font-semibold text-destructive-foreground">Ranking de alumnos con más faltas</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {estadisticas.rankingFaltas.map((item) => (
                <span key={item.alumnoId} className="rounded-full bg-card px-3 py-2 text-xs font-medium text-destructive-foreground">
                  {item.nombre}: {item.faltas}
                </span>
              ))}
            </div>
          </div>
        )}

        <HistorialTable
          items={historial}
          abierto={historialAbierto}
          onToggle={() => setHistorialAbierto((prev) => !prev)}
          onEditar={(item) => setSelectedSessionId(item.id)}
          onExportarPdf={(item) => exportar(item.materia.id, { formato: 'pdf', sesionId: item.id })}
          onExportarExcel={(item) => exportar(item.materia.id, { formato: 'excel', sesionId: item.id })}
        />
      </section>
    </div>
  )
}

function AdminAsistenciasView() {
  const { historial, estadisticas, obtenerHistorial, exportar } = useAsistenciaStore()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [filters, setFilters] = useState({
    docenteId: '',
    materiaId: '',
    grupoId: '',
    unidadId: '',
    fecha: '',
    semana: '',
    mes: '',
  })
  const [docentes, setDocentes] = useState([])
  const [materias, setMaterias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [materiaDetalle, setMateriaDetalle] = useState(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/usuarios?rol=DOCENTE'),
      api.get('/grupos'),
      obtenerHistorial({}),
    ])
      .then(([docentesRes, gruposRes]) => {
        setDocentes(docentesRes.data)
        setGrupos(gruposRes.data)
      })
      .catch(() => {})
  }, [obtenerHistorial])

  // Al elegir un docente sólo se ofrecen las materias que él imparte.
  useEffect(() => {
    let active = true

    api.get('/materias', {
      params: filters.docenteId ? { docenteId: filters.docenteId } : undefined,
    })
      .then((response) => {
        if (active) setMaterias(response.data)
      })
      .catch(() => {
        if (active) setMaterias([])
      })

    return () => {
      active = false
    }
  }, [filters.docenteId])

  useEffect(() => {
    if (!filters.materiaId) return undefined

    let active = true

    api.get(`/materias/${filters.materiaId}`)
      .then((response) => {
        if (active) setMateriaDetalle(response.data)
      })
      .catch(() => {
        if (active) setMateriaDetalle(null)
      })

    return () => {
      active = false
    }
  }, [filters.materiaId])

  // Exporta el conjunto filtrado completo, no una sola sesión.
  const exportarFiltrado = (formato) => {
    if (!filters.materiaId) return
    return exportar(filters.materiaId, {
      formato,
      grupoId: filters.grupoId || undefined,
      unidadId: filters.unidadId || undefined,
      fecha: filters.fecha || undefined,
      semana: filters.semana || undefined,
      mes: filters.mes || undefined,
      docenteId: filters.docenteId || undefined,
    })
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fecha' && value) {
        next.semana = ''
        next.mes = ''
      }
      if (key === 'semana' && value) {
        next.fecha = ''
        next.mes = ''
      }
      if (key === 'mes' && value) {
        next.fecha = ''
        next.semana = ''
      }
      // La materia elegida puede no ser de este docente.
      if (key === 'docenteId') {
        next.materiaId = ''
        next.unidadId = ''
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Administración de asistencias</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Consulta el historial completo, filtra por docente, materia, grupo, unidad, día, semana o mes, y exporta reportes reales en PDF o Excel.
        </p>
      </header>

      {estadisticas && (
        <div className="flex flex-wrap gap-2">
          <StatPill label="A" value={estadisticas.asistencias} tone="emerald" />
          <StatPill label="F" value={estadisticas.faltas} tone="rose" />
          <StatPill label="R" value={estadisticas.retardos} tone="amber" />
          <StatPill label="J" value={estadisticas.justificados} tone="sky" />
          <StatPill label="%" value={`${estadisticas.porcentaje ?? 0}%`} />
        </div>
      )}

      <FiltroToolbar
        filters={filters}
        onChange={handleFilterChange}
        onApply={() => {
          setHistorialAbierto(true)
          return obtenerHistorial(filters)
        }}
        materias={materias}
        grupos={grupos}
        unidades={filters.materiaId ? (materiaDetalle?.unidades ?? []) : []}
        docentes={docentes}
        showDocente
      />

      <div className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Reporte de lo filtrado</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {describirFiltro(filters, {
              materias,
              grupos,
              unidades: materiaDetalle?.unidades ?? [],
            })}
          </p>
          {!filters.materiaId && (
            <p id="export-filtrado-admin-ayuda" className="mt-1 text-xs text-muted-foreground">
              Elige una materia para poder guardar el reporte.
            </p>
          )}
        </div>
        <ExportActions
          onExportPdf={() => exportarFiltrado('pdf')}
          onExportExcel={() => exportarFiltrado('excel')}
          disabled={!filters.materiaId}
          ayudaId={!filters.materiaId ? 'export-filtrado-admin-ayuda' : undefined}
        />
      </div>

      {estadisticas?.rankingFaltas?.length > 0 && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5">
          <h3 className="text-sm font-semibold text-destructive-foreground">Ranking de alumnos con más faltas</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {estadisticas.rankingFaltas.map((item) => (
              <span key={item.alumnoId} className="rounded-full bg-card px-3 py-2 text-xs font-medium text-destructive-foreground">
                {item.nombre}: {item.faltas}
              </span>
            ))}
          </div>
        </div>
      )}

      <HistorialTable
        items={historial}
        abierto={historialAbierto}
        onToggle={() => setHistorialAbierto((prev) => !prev)}
        onEditar={(item) => setSelectedSessionId(item.id)}
        onExportarPdf={(item) => exportar(item.materia.id, { formato: 'pdf', sesionId: item.id, docenteId: filters.docenteId || undefined })}
        onExportarExcel={(item) => exportar(item.materia.id, { formato: 'excel', sesionId: item.id, docenteId: filters.docenteId || undefined })}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Edición histórica</h2>
        <AsistenciaSesionPanel
          sesionId={selectedSessionId}
          onSaved={() => obtenerHistorial(filters)}
        />
      </section>
    </div>
  )
}

export default function Asistencias() {
  const { user } = useAuthStore()

  if (user?.rol === 'DOCENTE') return <DocenteAsistenciasView />
  if (user?.rol === 'ADMIN') return <AdminAsistenciasView />
  return <AlumnoAsistenciasView />
}
