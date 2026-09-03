import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
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
      return 'bg-emerald-100 text-emerald-800'
    case 'FUERA_DE_HORARIO':
      return 'bg-amber-100 text-amber-800'
    case 'FINALIZADA':
      return 'bg-slate-200 text-slate-700'
    case 'PROGRAMADA_AHORA':
      return 'bg-blue-100 text-blue-800'
    case 'PASADA':
      return 'bg-rose-100 text-rose-800'
    case 'PROXIMA':
    default:
      return 'bg-indigo-100 text-indigo-800'
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
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-800',
    rose: 'bg-rose-100 text-rose-800',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-800',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {label}: {value}
    </span>
  )
}

function ExportActions({ onExportPdf, onExportExcel, label }) {
  return (
    <div className="flex flex-wrap gap-2">
      {label && (
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={onExportPdf}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Exportar PDF
      </button>
      <button
        type="button"
        onClick={onExportExcel}
        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Exportar Excel
      </button>
    </div>
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
    <article className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${principal ? 'p-6' : 'p-5'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoClaseStyle(clase.estado)}`}>
              {estadoClaseLabel(clase.estado)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {formatTime(clase.horaInicio)} - {formatTime(clase.horaFin)}
            </span>
            {clase.sesion?.fueFueraDeHorario && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                Sesión iniciada fuera de horario
              </span>
            )}
          </div>

          <div>
            <h2 className={`${principal ? 'text-2xl' : 'text-lg'} font-semibold text-slate-900`}>
              {clase.materia?.nombre}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {clase.grupo?.nombre ?? 'Sin grupo'} · {clase.aula?.nombre ?? 'Aula pendiente'}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
            <p>Materia: {clase.materia?.clave ?? 'Sin clave'}</p>
            <p>Fecha: {formatDate(new Date())}</p>
            <p>Unidad activa: {clase.unidadActiva?.nombre ?? 'No hay unidad activa'}</p>
            <p>Periodo: {clase.grupo?.periodo ?? 'Sin periodo'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:min-w-[220px]">
          <button
            type="button"
            onClick={onIniciar}
            disabled={Boolean(clase.sesion?.id) || requiereUnidadActiva}
            aria-describedby={requiereUnidadActiva ? inicioAyudaId : undefined}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {iniciarLabel}
          </button>
          {requiereUnidadActiva && (
            <p id={inicioAyudaId} className="px-1 text-xs leading-relaxed text-slate-500">
              Activa una unidad para asociar correctamente la asistencia de esta clase.
            </p>
          )}
          <button
            type="button"
            onClick={onTomarAsistencia}
            disabled={!clase.sesion?.id}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tomar asistencia
          </button>
          <button
            type="button"
            onClick={onFinalizar}
            disabled={!clase.sesion?.activa}
            className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finalizar clase
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {!clase.unidadActiva && unidadPendiente && (
          <button
            type="button"
            onClick={() => onIniciarUnidad(unidadPendiente)}
            className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200"
          >
            Iniciar {unidadPendiente.nombre}
          </button>
        )}

        {clase.unidadActiva && (
          <button
            type="button"
            onClick={() => onFinalizarUnidad(clase.unidadActiva, clase)}
            className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
          >
            Finalizar {clase.unidadActiva.nombre}
          </button>
        )}

        <span className="text-xs text-slate-500">
          La lista se arma con alumnos del grupo que además tienen inscripción aceptada en la materia.
        </span>
      </div>
    </article>
  )
}

function HistorialTable({ items, onEditar, onExportarPdf, onExportarExcel }) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No hay registros con los filtros actuales.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Clase</span>
        <span>Fecha</span>
        <span>Unidad</span>
        <span>Resumen</span>
        <span>Acciones</span>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{item.materia?.nombre}</p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {item.grupo?.nombre ?? 'Sin grupo'} · {item.aula?.nombre ?? 'Aula pendiente'}
              </p>
            </div>
            <div className="text-sm text-slate-600">
              <p>{formatDate(item.fecha)}</p>
              <p className="mt-1 text-xs text-slate-400">Semana {item.semanaClave}</p>
            </div>
            <div className="text-sm text-slate-600">
              {item.unidad?.nombre ?? 'Sin unidad'}
            </div>
            <div className="flex flex-wrap gap-2">
              <StatPill label="A" value={item.resumen?.asistencias ?? 0} tone="emerald" />
              <StatPill label="F" value={item.resumen?.faltas ?? 0} tone="rose" />
              <StatPill label="R" value={item.resumen?.retardos ?? 0} tone="amber" />
              <StatPill label="J" value={item.resumen?.justificados ?? 0} tone="sky" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEditar(item)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onExportarPdf(item)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => onExportarExcel(item)}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Excel
              </button>
            </div>
          </div>
        ))}
      </div>
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
      <button
        type="button"
        onClick={toggleCalendar}
        disabled={disabled || loading}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-input bg-background px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-70"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{value ? formatSelectedDate(value, week) : placeholder}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 z-30 mt-2 w-[calc(100vw-3rem)] max-w-[19rem] rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl shadow-slate-900/10"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-sm font-semibold">{MESES[visibleMonth.month]} {visibleMonth.year}</p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
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
                <button
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
                        ? 'bg-primary/10 font-semibold text-primary hover:bg-primary hover:text-primary-foreground'
                        : 'cursor-default text-muted-foreground/45'
                  }`}
                >
                  {day}
                  {available && !selected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[11px] leading-4 text-muted-foreground">Sólo se marcan días con clase impartida.</p>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Limpiar
              </button>
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
  gruposLoading = false,
  fechasLoading = false,
  gruposRestringidos = false,
}) {
  const grupoDisabled = gruposRestringidos && (
    !filters.materiaId || gruposLoading || grupos.length === 0
  )

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {showDocente && (
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Docente</span>
            <select
              value={filters.docenteId}
              onChange={(event) => onChange('docenteId', event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            >
              <option value="">Todos los docentes</option>
              {docentes.map((docente) => (
                <option key={docente.id} value={docente.id}>{docente.nombre}</option>
              ))}
            </select>
          </label>
        )}

        <label className="min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Materia</span>
          <select
            value={filters.materiaId}
            onChange={(event) => onChange('materiaId', event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
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
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Grupo</span>
          <select
            value={filters.grupoId}
            onChange={(event) => onChange('grupoId', event.target.value)}
            disabled={grupoDisabled}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Unidad</span>
          <select
            value={filters.unidadId}
            onChange={(event) => onChange('unidadId', event.target.value)}
            disabled={!filters.materiaId}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
          </>
        ) : (
          <>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha</span>
              <input
                type="date"
                value={filters.fecha}
                onChange={(event) => onChange('fecha', event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Semana</span>
              <input
                type="date"
                value={filters.semana}
                onChange={(event) => onChange('semana', event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
            </label>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Aplicar filtros
        </button>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
          Para filtrar por semana, elige cualquier fecha de esa semana.
        </span>
      </div>
    </div>
  )
}

function AttendanceBar({ percentage }) {
  const pct = Math.min(100, Math.max(0, percentage ?? 0))
  const color =
    pct >= 85 ? 'bg-emerald-500' :
    pct >= 70 ? 'bg-amber-400' :
    'bg-rose-500'

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MiniStat({ label, value, color = 'text-slate-700' }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className={`text-base font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
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
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {materia.clave}
              </span>
            </div>
            <h2 className="text-base font-semibold leading-snug text-slate-900 line-clamp-2">
              {materia.nombre}
            </h2>
            <p className="mt-1 text-xs text-slate-500 truncate">{detalleGrupo}</p>
            <p className="mt-0.5 text-xs text-slate-400 truncate">
              {materia.docente?.nombre ?? 'Docente por asignar'}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <AttendanceBadge percentage={pct} />
            <span className="text-[11px] text-slate-400 tabular-nums">
              {resumen.totalSesiones ?? 0} sesiones
            </span>
          </div>
        </div>

        <div className="mt-4">
          <AttendanceBar percentage={pct} />
        </div>

        <div className="mt-4 grid grid-cols-4 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3">
          <MiniStat label="Asist." value={resumen.asistencias ?? 0} color="text-emerald-600" />
          <MiniStat label="Faltas" value={resumen.faltas ?? 0} color="text-rose-500" />
          <MiniStat label="Retard." value={resumen.retardos ?? 0} color="text-amber-500" />
          <MiniStat label="Justif." value={resumen.justificados ?? 0} color="text-sky-500" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="min-w-0">
          {statusMsg ? (
            <p className={`text-xs truncate ${statusMsg.warn ? 'text-amber-600' : 'text-emerald-600'}`}>
              {statusMsg.warn ? '⚠ ' : '✓ '}{statusMsg.text}
            </p>
          ) : (
            <p className="text-xs text-slate-400">Última clase: {formatDate(ultimaSesion)}</p>
          )}
          {statusMsg && (
            <p className="text-[11px] text-slate-400 mt-0.5">Última clase: {formatDate(ultimaSesion)}</p>
          )}
        </div>
        <Link
          to={`/alumno/materias/${materia.id}`}
          className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
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
    porcentajeGlobal >= 85 ? 'text-emerald-600' :
    porcentajeGlobal >= 70 ? 'text-amber-500' :
    'text-rose-600'

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Panel del alumno</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mis asistencias</h1>
        <p className="text-sm text-slate-500">
          Consulta tu avance por materia e identifica faltas antes de que afecten tu evaluación.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="mt-0.5 shrink-0 text-rose-400">⚠</span>
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Materias</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-slate-800">{estadisticas.materias}</p>
          <p className="mt-1 text-xs text-slate-400">inscritas este periodo</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500">Asistencias</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-emerald-700">{estadisticas.asistencias}</p>
          <p className="mt-1 text-xs text-emerald-400">presencias registradas</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Faltas</p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-rose-600">{estadisticas.faltas}</p>
          <p className="mt-1 text-xs text-rose-300">ausencias acumuladas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">% Global</p>
          <p className={`mt-3 text-4xl font-bold tabular-nums ${pctColor}`}>{porcentajeGlobal}%</p>
          <div className="mt-2">
            <AttendanceBar percentage={porcentajeGlobal} />
          </div>
        </div>
      </section>

      {!loading && resumen.length > 0 && (estadisticas.retardos > 0 || estadisticas.justificados > 0 || estadisticas.sinRegistro > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {estadisticas.retardos > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-600 ring-1 ring-amber-200">
              {estadisticas.retardos} retardo{estadisticas.retardos !== 1 ? 's' : ''}
            </span>
          )}
          {estadisticas.justificados > 0 && (
            <span className="rounded-full bg-sky-50 px-3 py-1.5 font-medium text-sky-600 ring-1 ring-sky-200">
              {estadisticas.justificados} justificado{estadisticas.justificados !== 1 ? 's' : ''}
            </span>
          )}
          {estadisticas.sinRegistro > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-500 ring-1 ring-slate-200">
              {estadisticas.sinRegistro} sin captura
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-500 ring-1 ring-slate-200">
            {estadisticas.totalSesiones} sesiones totales
          </span>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Por materia</h2>
        {loading ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : resumen.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-500">Sin materias disponibles</p>
            <p className="mt-1 text-xs text-slate-400">No hay sesiones registradas en este momento.</p>
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

function DocenteAsistenciasView() {
  const navigate = useNavigate()
  const { panelDocente, cargarPanelDocente, iniciar, finalizar } = useClaseStore()
  const { historial, estadisticas, obtenerHistorial, exportar } = useAsistenciaStore()
  const { user } = useAuthStore()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [exportSuggestion, setExportSuggestion] = useState(null)
  const [filters, setFilters] = useState({
    materiaId: '',
    grupoId: '',
    unidadId: '',
    fecha: '',
    semana: '',
  })
  const [opcionesFiltros, setOpcionesFiltros] = useState({
    materias: [],
    grupos: [],
    unidades: [],
    fechasClase: [],
  })
  const [opcionesLoading, setOpcionesLoading] = useState(false)
  const [opcionesError, setOpcionesError] = useState('')
  const opcionesRequestId = useRef(0)

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
        }))
        setOpcionesError(getApiErrorMessage(error, 'No se pudieron comprobar los grupos y fechas de esta materia.'))
      }
      return null
    } finally {
      if (requestId === opcionesRequestId.current) setOpcionesLoading(false)
    }
  }

  const cargarTodo = async (nextFilters = filters) => {
    const requests = [
      cargarPanelDocente(),
      obtenerHistorial(nextFilters),
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
  }, [cargarPanelDocente, obtenerHistorial])

  const clasesHoy = panelDocente?.clasesHoy ?? []
  const clasePrincipal = panelDocente?.claseActual ?? panelDocente?.proximaClase ?? null

  const materias = opcionesFiltros.materias ?? []
  const grupos = opcionesFiltros.grupos ?? []
  const fechasClase = opcionesFiltros.fechasClase ?? []
  const unidades = opcionesFiltros.unidades ?? []

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

  const handleFinalizeClass = async (clase) => {
    if (!clase?.sesion?.id) return
    if (!window.confirm('¿Finalizar la clase? Los alumnos sin captura quedarán como falta.')) return

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
  }

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

  const applyFilters = () => cargarTodo(filters)

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
      }))
      if (value) {
        cargarOpcionesFiltros(value)
      }
    } else if (key === 'grupoId') {
      opcionesRequestId.current += 1
      setOpcionesFiltros((current) => ({ ...current, fechasClase: [] }))
      cargarOpcionesFiltros(filters.materiaId, value)
    }

    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fecha' && value) next.semana = ''
      if (key === 'semana' && value) next.fecha = ''
      if (key === 'materiaId') {
        next.grupoId = ''
        next.unidadId = ''
        next.fecha = ''
        next.semana = ''
      }
      if (key === 'grupoId') {
        next.fecha = ''
        next.semana = ''
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Asistencia docente</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          La pantalla prioriza tu horario real del día. Inicia la clase, captura la lista del grupo y materia correctos, y edita el historial cuando sea necesario.
        </p>
      </header>

      {mensaje && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {mensaje}
        </div>
      )}

      {exportSuggestion && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-slate-600">{exportSuggestion.label}</p>
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
          <h2 className="text-xl font-semibold text-slate-900">Clase actual</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
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
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No tienes clases programadas para hoy.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Mis clases de hoy</h2>
          <button
            type="button"
            onClick={() => cargarTodo()}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Actualizar
          </button>
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Toma de asistencia</h2>
          {selectedSessionId && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
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
            <h2 className="text-xl font-semibold text-slate-900">Historial y reportes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Filtra por materia, grupo, fecha, semana o unidad. Puedes abrir cualquier sesión histórica y volver a editarla.
            </p>
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

        <FiltroToolbar
          filters={filters}
          onChange={handleFilterChange}
          onApply={applyFilters}
          materias={materias}
          grupos={grupos}
          unidades={unidades}
          fechasClase={fechasClase}
          gruposLoading={opcionesLoading}
          fechasLoading={opcionesLoading}
          gruposRestringidos
        />

        {opcionesError && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {opcionesError}
          </p>
        )}

        {estadisticas?.rankingFaltas?.length > 0 && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <h3 className="text-sm font-semibold text-rose-900">Ranking de alumnos con más faltas</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {estadisticas.rankingFaltas.map((item) => (
                <span key={item.alumnoId} className="rounded-full bg-white px-3 py-2 text-xs font-medium text-rose-700">
                  {item.nombre}: {item.faltas}
                </span>
              ))}
            </div>
          </div>
        )}

        <HistorialTable
          items={historial}
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
  })
  const [docentes, setDocentes] = useState([])
  const [materias, setMaterias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [materiaDetalle, setMateriaDetalle] = useState(null)

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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fecha' && value) next.semana = ''
      if (key === 'semana' && value) next.fecha = ''
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Administración de asistencias</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Consulta el historial completo, filtra por docente, materia, grupo, fecha, semana o unidad, y exporta reportes reales en PDF o Excel.
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
        onApply={() => obtenerHistorial(filters)}
        materias={materias}
        grupos={grupos}
        unidades={filters.materiaId ? (materiaDetalle?.unidades ?? []) : []}
        docentes={docentes}
        showDocente
      />

      {estadisticas?.rankingFaltas?.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="text-sm font-semibold text-rose-900">Ranking de alumnos con más faltas</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {estadisticas.rankingFaltas.map((item) => (
              <span key={item.alumnoId} className="rounded-full bg-white px-3 py-2 text-xs font-medium text-rose-700">
                {item.nombre}: {item.faltas}
              </span>
            ))}
          </div>
        </div>
      )}

      <HistorialTable
        items={historial}
        onEditar={(item) => setSelectedSessionId(item.id)}
        onExportarPdf={(item) => exportar(item.materia.id, { formato: 'pdf', sesionId: item.id, docenteId: filters.docenteId || undefined })}
        onExportarExcel={(item) => exportar(item.materia.id, { formato: 'excel', sesionId: item.id, docenteId: filters.docenteId || undefined })}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Edición histórica</h2>
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
