import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  RefreshCcw,
  Save,
} from 'lucide-react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { useCalificacionStore } from '../store/calificacionStore'

const DEFAULT_WEIGHTS = {
  pesoTareas: '80',
  pesoAsistencia: '20',
}

const STATUS_META = {
  APROBADO: {
    label: 'Aprobado',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  REQUIERE_ATENCION: {
    label: 'Requiere atención',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  PENDIENTE: {
    label: 'Pendiente',
    className: 'bg-slate-50 text-slate-600 ring-slate-200',
  },
}

function formatGrade(value) {
  return typeof value === 'number' ? value : '-'
}

function getCalificacionFinal(row) {
  return row.calificacionFinal ?? row.calificacionSugerida
}

function getRowKey(row) {
  return `${row.materia?.id}-${row.unidad?.id ?? row.unidad?.orden}-${row.alumno?.id}`
}

function getFuenteLabel(fuente) {
  if (fuente === 'MANUAL') return 'Manual'
  if (fuente === 'CALCULADA') return 'Calculada'
  return 'Pendiente'
}

function StatusBadge({ estado }) {
  const meta = STATUS_META[estado] ?? STATUS_META.PENDIENTE
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function SelectField({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="flex min-w-[12rem] flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {children}
      </select>
    </label>
  )
}

function NumberField({ label, value, onChange, min = 0, max = 100, disabled = false }) {
  return (
    <label className="flex min-w-[8rem] flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
    </label>
  )
}

function MetricCard({ icon, label, value, tone = 'slate' }) {
  const Icon = icon
  const tones = {
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className={`rounded-3xl border p-5 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value ?? '-'}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function CalificacionesTable({
  rows,
  showMateria = false,
  editable = false,
  drafts = {},
  savingKey = null,
  onDraftChange,
  onSaveManual,
}) {
  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
        Sin calificaciones disponibles.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">No. control</th>
              <th className="px-4 py-3">Alumno</th>
              {showMateria && <th className="px-4 py-3">Materia</th>}
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Calificación</th>
              <th className="px-4 py-3">Cálculo</th>
              {editable ? (
                <>
                  <th className="px-4 py-3">Manual</th>
                  <th className="px-4 py-3">Observación</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Observación</th>
                </>
              )}
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Tareas</th>
              <th className="px-4 py-3">Asistencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => {
              const rowKey = getRowKey(row)
              const draft = drafts[rowKey] ?? {}
              const final = getCalificacionFinal(row)
              const canSave = editable && row.unidad?.id
              const saving = savingKey === rowKey

              return (
                <tr key={rowKey}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.alumno?.numeroControl || '-'}</td>
                  <td className="min-w-[14rem] px-4 py-3 font-medium text-slate-900">{row.alumno?.nombre}</td>
                  {showMateria && (
                    <td className="min-w-[14rem] px-4 py-3">
                      <p className="font-medium text-slate-800">{row.materia?.nombre}</p>
                      <p className="text-xs text-slate-400">{row.materia?.clave}</p>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">{row.grupo?.nombre || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.unidad?.nombre || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-lg font-semibold text-slate-900">{formatGrade(final)}</span>
                    <span className="ml-2 text-xs text-slate-400">{getFuenteLabel(row.fuenteCalificacion)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-slate-700">{formatGrade(row.calificacionCalculada)}</span>
                    {typeof row.promedioTareas === 'number' && (
                      <p className="text-xs text-slate-400">Tareas {row.promedioTareas}</p>
                    )}
                  </td>
                  {editable ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={draft.calificacionManual ?? ''}
                          onChange={(event) => onDraftChange?.(row, 'calificacionManual', event.target.value)}
                          className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                          placeholder="-"
                        />
                      </td>
                      <td className="min-w-[18rem] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={draft.observacion ?? ''}
                            onChange={(event) => onDraftChange?.(row, 'observacion', event.target.value)}
                            className="min-w-[14rem] flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                            placeholder="Observación opcional"
                            maxLength={180}
                          />
                          <button
                            type="button"
                            disabled={!canSave || saving}
                            onClick={() => onSaveManual?.(row)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? 'Guardando' : 'Guardar'}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {getFuenteLabel(row.fuenteCalificacion)}
                      </td>
                      <td className="min-w-[16rem] px-4 py-3 text-slate-500">
                        {row.observacionManual || row.observaciones?.[0] || '-'}
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge estado={row.estado} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {row.tareas?.calificadas ?? 0}/{row.tareas?.total ?? 0} calificadas
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {row.asistencia?.porcentaje ?? 0}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocenteCalificaciones() {
  const {
    reporteDocente,
    loading,
    error,
    obtenerDocente,
    exportarCaptura,
    guardarManual,
  } = useCalificacionStore()
  const [materias, setMaterias] = useState([])
  const [filters, setFilters] = useState({
    materiaId: '',
    grupoId: '',
    unidadId: '',
    ...DEFAULT_WEIGHTS,
  })
  const [downloading, setDownloading] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [savingKey, setSavingKey] = useState(null)

  const cargarMaterias = useCallback(() => {
    api.get('/materias/mis-materias')
      .then((response) => setMaterias(response.data || []))
      .catch(() => setMaterias([]))
  }, [])

  useEffect(() => {
    cargarMaterias()
  }, [cargarMaterias])

  useEffect(() => {
    if (!filters.materiaId) return
    obtenerDocente({
      materiaId: filters.materiaId,
      grupoId: filters.grupoId || undefined,
      unidadId: filters.unidadId || undefined,
      pesoTareas: filters.pesoTareas,
      pesoAsistencia: filters.pesoAsistencia,
    }).catch(() => {})
  }, [filters, obtenerDocente])

  const selectedMateria = useMemo(
    () => materias.find((materia) => materia.id === Number(filters.materiaId)),
    [materias, filters.materiaId],
  )
  const rows = filters.materiaId ? reporteDocente?.rows ?? [] : []
  const metrics = filters.materiaId ? reporteDocente?.metrics ?? {} : {}
  const canExport = Boolean(filters.materiaId)

  useEffect(() => {
    const nextDrafts = {}
    for (const row of rows) {
      nextDrafts[getRowKey(row)] = {
        calificacionManual: row.calificacionManual ?? '',
        observacion: row.observacionManual ?? '',
      }
    }
    setDrafts(nextDrafts)
  }, [rows])

  const handleExport = async (formato) => {
    if (!canExport) return
    setDownloading(formato)
    try {
      await exportarCaptura({
        materiaId: filters.materiaId,
        grupoId: filters.grupoId || undefined,
        unidadId: filters.unidadId || undefined,
        pesoTareas: filters.pesoTareas,
        pesoAsistencia: filters.pesoAsistencia,
      }, formato)
    } finally {
      setDownloading(null)
    }
  }

  const handleDraftChange = useCallback((row, field, value) => {
    const rowKey = getRowKey(row)
    setDrafts((prev) => ({
      ...prev,
      [rowKey]: {
        calificacionManual: prev[rowKey]?.calificacionManual ?? '',
        observacion: prev[rowKey]?.observacion ?? '',
        [field]: value,
      },
    }))
  }, [])

  const handleSaveManual = useCallback(async (row) => {
    if (!row.unidad?.id) return
    const rowKey = getRowKey(row)
    const draft = drafts[rowKey] ?? {}
    const manualValue = String(draft.calificacionManual ?? '').trim()
    const calificacionManual = manualValue === '' ? null : Number(manualValue)

    setSavingKey(rowKey)
    try {
      await guardarManual({
        alumnoId: row.alumno?.id,
        materiaId: row.materia?.id,
        unidadId: row.unidad.id,
        grupoId: filters.grupoId ? Number(filters.grupoId) : undefined,
        calificacionManual,
        observacion: draft.observacion ?? '',
      }, {
        grupoId: filters.grupoId || undefined,
        unidadId: filters.unidadId || undefined,
        pesoTareas: filters.pesoTareas,
        pesoAsistencia: filters.pesoAsistencia,
      })
    } finally {
      setSavingKey(null)
    }
  }, [drafts, filters, guardarManual])

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-sky-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-100">
              Docente
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Calificaciones</h1>
            <p className="mt-2 text-sm text-slate-500">Lista por unidad con avance de tareas y asistencia.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!canExport || downloading !== null}
              onClick={() => handleExport('excel')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {downloading === 'excel' ? 'Generando...' : 'Excel'}
            </button>
            <button
              type="button"
              disabled={!canExport || downloading !== null}
              onClick={() => handleExport('csv')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloading === 'csv' ? 'Generando...' : 'CSV'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Filtros</h2>
        </div>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:flex-wrap">
          <SelectField
            label="Materia"
            value={filters.materiaId}
            onChange={(event) => setFilters((prev) => ({
              ...prev,
              materiaId: event.target.value,
              grupoId: '',
              unidadId: '',
            }))}
          >
            <option value="">Selecciona materia</option>
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>{materia.nombre}</option>
            ))}
          </SelectField>

          <SelectField
            label="Grupo"
            value={filters.grupoId}
            disabled={!selectedMateria}
            onChange={(event) => setFilters((prev) => ({ ...prev, grupoId: event.target.value }))}
          >
            <option value="">Todos los grupos</option>
            {(selectedMateria?.grupos ?? []).map((grupo) => (
              <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
            ))}
          </SelectField>

          <SelectField
            label="Unidad"
            value={filters.unidadId}
            disabled={!selectedMateria}
            onChange={(event) => setFilters((prev) => ({ ...prev, unidadId: event.target.value }))}
          >
            <option value="">Todas las unidades</option>
            {(selectedMateria?.unidades ?? []).map((unidad) => (
              <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
            ))}
          </SelectField>

          <NumberField
            label="Tareas %"
            value={filters.pesoTareas}
            onChange={(event) => setFilters((prev) => ({ ...prev, pesoTareas: event.target.value }))}
          />

          <NumberField
            label="Asistencia %"
            value={filters.pesoAsistencia}
            onChange={(event) => setFilters((prev) => ({ ...prev, pesoAsistencia: event.target.value }))}
          />

          <button
            type="button"
            onClick={() => setFilters({ materiaId: '', grupoId: '', unidadId: '', ...DEFAULT_WEIGHTS })}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Limpiar
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {Array.isArray(error) ? error.join(', ') : error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardList} label="Registros" value={metrics.totalFilas ?? 0} tone="blue" />
        <MetricCard icon={CheckCircle2} label="Aprobadas" value={metrics.aprobadas ?? 0} tone="green" />
        <MetricCard icon={AlertTriangle} label="Requieren atención" value={metrics.requiereAtencion ?? 0} tone="amber" />
        <MetricCard icon={GraduationCap} label="Promedio" value={formatGrade(metrics.promedioGeneral)} tone="slate" />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Lista para captura</h2>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
            Cargando calificaciones...
          </div>
        ) : !filters.materiaId ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
            Selecciona una materia para generar la lista.
          </div>
        ) : (
          <CalificacionesTable
            rows={rows}
            editable
            drafts={drafts}
            savingKey={savingKey}
            onDraftChange={handleDraftChange}
            onSaveManual={handleSaveManual}
          />
        )}
      </section>
    </div>
  )
}

function AlumnoCalificaciones() {
  const { reporteAlumno, loading, error, obtenerAlumno } = useCalificacionStore()
  const [materias, setMaterias] = useState([])
  const [materiaId, setMateriaId] = useState('')

  useEffect(() => {
    api.get('/materias/para-alumno')
      .then((response) => setMaterias(response.data || []))
      .catch(() => setMaterias([]))
  }, [])

  useEffect(() => {
    obtenerAlumno({ materiaId: materiaId || undefined }).catch(() => {})
  }, [materiaId, obtenerAlumno])

  const rows = reporteAlumno?.rows ?? []
  const metrics = reporteAlumno?.metrics ?? {}
  const rowsFiltradas = useMemo(
    () => [...rows].sort(
      (a, b) =>
        a.materia?.nombre?.localeCompare(b.materia?.nombre ?? '', 'es') ||
        (a.unidad?.orden ?? 0) - (b.unidad?.orden ?? 0),
    ),
    [rows],
  )

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-7">
        <span className="inline-flex rounded-full bg-sky-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-100">
          Alumno
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Mis calificaciones</h1>
        <p className="mt-2 text-sm text-slate-500">Consulta por unidad con resumen de asistencia y tareas.</p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <SelectField
          label="Materia"
          value={materiaId}
          onChange={(event) => setMateriaId(event.target.value)}
        >
          <option value="">Todas las materias</option>
          {materias.map((materia) => (
            <option key={materia.id} value={materia.id}>{materia.nombre}</option>
          ))}
        </SelectField>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {Array.isArray(error) ? error.join(', ') : error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardList} label="Unidades" value={metrics.totalFilas ?? 0} tone="blue" />
        <MetricCard icon={CheckCircle2} label="Aprobadas" value={metrics.aprobadas ?? 0} tone="green" />
        <MetricCard icon={AlertTriangle} label="Requieren atención" value={metrics.requiereAtencion ?? 0} tone="amber" />
        <MetricCard icon={GraduationCap} label="Promedio" value={formatGrade(metrics.promedioGeneral)} tone="slate" />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Avance por unidad</h2>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
            Cargando calificaciones...
          </div>
        ) : (
          <CalificacionesTable rows={rowsFiltradas} showMateria />
        )}
      </section>
    </div>
  )
}

export default function Calificaciones() {
  const user = useAuthStore((state) => state.user)
  return user?.rol === 'ALUMNO' ? <AlumnoCalificaciones /> : <DocenteCalificaciones />
}
