import { Button } from '@/components/ui/button'
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

const STATUS_META = {
  APROBADO: {
    label: 'Aprobado',
    className: "bg-success/10 text-success-foreground ring-ring",
  },
  REQUIERE_ATENCION: {
    label: 'Requiere atención',
    className: "bg-warning/10 text-warning-foreground ring-ring",
  },
  PENDIENTE: {
    label: 'Pendiente',
    className: "bg-background text-muted-foreground ring-ring",
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
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-background"
      >
        {children}
      </select>
    </label>
  )
}

function NumberField({ label, value, onChange, min = 0, max = 100, disabled = false }) {
  return (
    <label className="flex min-w-[8rem] flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-background"
      />
    </label>
  )
}

function MetricCard({ icon, label, value, tone = 'slate' }) {
  const Icon = icon
  const tones = {
    blue: "border-border bg-accent text-primary-ink",
    green: "border-success/30 bg-success/10 text-success-foreground",
    amber: "border-warning/30 bg-warning/10 text-warning-foreground",
    slate: "border-border bg-background text-foreground",
  }

  return (
    <div className={`rounded-3xl border p-5 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value ?? '-'}</p>
        </div>
        <div className="rounded-2xl bg-card/80 p-3">
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
      <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center text-sm text-muted-foreground">
        Sin calificaciones disponibles.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de calificaciones">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-background text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((row) => {
              const rowKey = getRowKey(row)
              const draft = drafts[rowKey] ?? {}
              const final = getCalificacionFinal(row)
              const canSave = editable && row.unidad?.id
              const saving = savingKey === rowKey

              return (
                <tr key={rowKey}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{row.alumno?.numeroControl || '-'}</td>
                  <td className="min-w-[14rem] px-4 py-3 font-medium text-foreground">{row.alumno?.nombre}</td>
                  {showMateria && (
                    <td className="min-w-[14rem] px-4 py-3">
                      <p className="font-medium text-foreground">{row.materia?.nombre}</p>
                      <p className="text-xs text-muted-foreground">{row.materia?.clave}</p>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">{row.grupo?.nombre || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.unidad?.nombre || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-lg font-semibold text-foreground">{formatGrade(final)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{getFuenteLabel(row.fuenteCalificacion)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-foreground">{formatGrade(row.calificacionCalculada)}</span>
                    {typeof row.promedioTareas === 'number' && (
                      <p className="text-xs text-muted-foreground">Tareas {row.promedioTareas}</p>
                    )}
                  </td>
                  {editable ? (
                    <>
                      <td className="px-4 py-3">
                        <input aria-label={`Calificación de ${row.alumno?.nombre ?? row.nombre ?? "alumno"}`}
                          type="number"
                          min="1"
                          max="100"
                          value={draft.calificacionManual ?? ''}
                          onChange={(event) => onDraftChange?.(row, 'calificacionManual', event.target.value)}
                          className="w-24 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                          placeholder="-"
                        />
                      </td>
                      <td className="min-w-[18rem] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input aria-label={`Observación de ${row.alumno?.nombre ?? row.nombre ?? "alumno"}`}
                            type="text"
                            value={draft.observacion ?? ''}
                            onChange={(event) => onDraftChange?.(row, 'observacion', event.target.value)}
                            className="min-w-[14rem] flex-1 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                            placeholder="Observación opcional"
                            maxLength={180}
                          />
                          <Button variant="default"
                            type="button"
                            disabled={!canSave || saving}
                            onClick={() => onSaveManual?.(row)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? 'Guardando' : 'Guardar'}
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {getFuenteLabel(row.fuenteCalificacion)}
                      </td>
                      <td className="min-w-[16rem] px-4 py-3 text-muted-foreground">
                        {row.observacionManual || row.observaciones?.[0] || '-'}
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge estado={row.estado} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {row.tareas?.calificadas ?? 0}/{row.tareas?.total ?? 0} calificadas
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
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
    guardarPonderacion,
  } = useCalificacionStore()
  const [materias, setMaterias] = useState([])
  const [filters, setFilters] = useState({
    materiaId: '',
    grupoId: '',
    unidadId: '',
  })
  const [downloading, setDownloading] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [savingKey, setSavingKey] = useState(null)
  // La ponderación se guarda en la materia (servidor); aquí sólo el borrador.
  const [weights, setWeights] = useState({ pesoTareas: '', pesoAsistencia: '' })
  const [savingWeights, setSavingWeights] = useState(false)
  const [weightsNotice, setWeightsNotice] = useState('')

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
    }).catch(() => {})
  }, [filters, obtenerDocente])

  const ponderacion = filters.materiaId ? reporteDocente?.ponderacion : null
  useEffect(() => {
    setWeights({
      pesoTareas: ponderacion ? String(ponderacion.tareas) : '',
      pesoAsistencia: ponderacion ? String(ponderacion.asistencia) : '',
    })
  }, [ponderacion])
  useEffect(() => { setWeightsNotice('') }, [filters.materiaId])
  const handleWeightChange = (field) => (event) => {
    setWeightsNotice('')
    setWeights((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const weightsDirty = Boolean(ponderacion) && (
    weights.pesoTareas !== String(ponderacion.tareas) || weights.pesoAsistencia !== String(ponderacion.asistencia)
  )
  const weightsSum = Number(weights.pesoTareas || 0) + Number(weights.pesoAsistencia || 0)

  const handleSaveWeights = async () => {
    if (!filters.materiaId || savingWeights) return
    setSavingWeights(true)
    setWeightsNotice('')
    try {
      await guardarPonderacion({
        materiaId: Number(filters.materiaId),
        pesoTareas: Number(weights.pesoTareas),
        pesoAsistencia: Number(weights.pesoAsistencia),
      })
      await obtenerDocente({
        materiaId: filters.materiaId,
        grupoId: filters.grupoId || undefined,
        unidadId: filters.unidadId || undefined,
      })
      setWeightsNotice('Ponderación guardada. Se aplica a reportes, exportaciones y a la vista de los alumnos.')
    } catch {
      // El store ya expone el mensaje en `error`.
    } finally {
      setSavingWeights(false)
    }
  }

  const selectedMateria = useMemo(
    () => materias.find((materia) => materia.id === Number(filters.materiaId)),
    [materias, filters.materiaId],
  )
  // Sin memoizar, el `[]` era un array nuevo en cada render: el efecto de
  // abajo depende de `rows`, llamaba a setDrafts y volvía a renderizar en
  // bucle, dejando la app congelada hasta recargar.
  const rows = useMemo(
    () => (filters.materiaId ? reporteDocente?.rows ?? [] : []),
    [filters.materiaId, reporteDocente?.rows],
  )
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
      })
    } finally {
      setSavingKey(null)
    }
  }, [drafts, filters, guardarManual])

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-card px-6 py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-accent px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-ink ring-1 ring-ring">
              Docente
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Calificaciones</h1>
            <p className="mt-2 text-sm text-muted-foreground">Lista por unidad con avance de tareas y asistencia.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="default"
              type="button"
              disabled={!canExport || downloading !== null}
              onClick={() => handleExport('excel')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {downloading === 'excel' ? 'Generando...' : 'Excel'}
            </Button>
            <Button variant="outline"
              type="button"
              disabled={!canExport || downloading !== null}
              onClick={() => handleExport('csv')}
              className="inline-flex items-center justify-center gap-2 border px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloading === 'csv' ? 'Generando...' : 'CSV'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-foreground">
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

          <Button variant="outline"
            type="button"
            onClick={() => setFilters({ materiaId: '', grupoId: '', unidadId: '' })}
            className="mt-auto inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold"
          >
            <RefreshCcw className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-foreground">
          <GraduationCap className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Ponderación de la materia</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Se guarda en la materia y la usan por igual esta lista, las exportaciones y la vista de los alumnos.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <NumberField
            label="Tareas %"
            value={weights.pesoTareas}
            disabled={!ponderacion}
            onChange={handleWeightChange('pesoTareas')}
          />
          <NumberField
            label="Asistencia %"
            value={weights.pesoAsistencia}
            disabled={!ponderacion}
            onChange={handleWeightChange('pesoAsistencia')}
          />
          <Button variant="default"
            type="button"
            disabled={!ponderacion || !weightsDirty || weightsSum !== 100 || savingWeights}
            onClick={handleSaveWeights}
            className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {savingWeights ? 'Guardando...' : 'Guardar ponderación'}
          </Button>
        </div>
        {ponderacion && weightsSum !== 100 && (
          <p role="alert" className="mt-2 text-sm text-destructive-foreground">Tareas y asistencia deben sumar 100 % (ahora suman {weightsSum} %).</p>
        )}
        {weightsNotice && <p role="status" className="mt-2 text-sm text-muted-foreground">{weightsNotice}</p>}
      </section>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {Array.isArray(error) ? error.join(', ') : error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardList} label="Registros" value={metrics.totalFilas ?? 0} tone="blue" />
        <MetricCard icon={CheckCircle2} label="Aprobadas" value={metrics.aprobadas ?? 0} tone="green" />
        <MetricCard icon={AlertTriangle} label="Requieren atención" value={metrics.requiereAtencion ?? 0} tone="amber" />
        <MetricCard icon={GraduationCap} label="Promedio" value={formatGrade(metrics.promedioGeneral)} tone="slate" />
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Lista para captura</h2>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center text-sm text-muted-foreground">
            Cargando calificaciones...
          </div>
        ) : !filters.materiaId ? (
          <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center text-sm text-muted-foreground">
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

  const rows = useMemo(() => reporteAlumno?.rows ?? [], [reporteAlumno?.rows])
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
      <section className="rounded-[2rem] border border-border bg-card px-6 py-7">
        <span className="inline-flex rounded-full bg-accent px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-ink ring-1 ring-ring">
          Alumno
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Mis calificaciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Consulta por unidad con resumen de asistencia y tareas.</p>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5">
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
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {Array.isArray(error) ? error.join(', ') : error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardList} label="Unidades" value={metrics.totalFilas ?? 0} tone="blue" />
        <MetricCard icon={CheckCircle2} label="Aprobadas" value={metrics.aprobadas ?? 0} tone="green" />
        <MetricCard icon={AlertTriangle} label="Requieren atención" value={metrics.requiereAtencion ?? 0} tone="amber" />
        <MetricCard icon={GraduationCap} label="Promedio" value={formatGrade(metrics.promedioGeneral)} tone="slate" />
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Avance por unidad</h2>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center text-sm text-muted-foreground">
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
