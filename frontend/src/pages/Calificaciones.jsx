import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  LayoutGrid,
  List,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react'
import api from '../api/axios'
import SexoBadge from '../components/SexoBadge'
import useUnsavedChangesGuard from '@/hooks/useUnsavedChangesGuard'
import { useIsMobile } from '@/hooks/use-mobile'
import { confirmAction, notify } from '@/lib/feedback'
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

// Mismo umbral que usa el servidor para marcar "Requiere atención".
const CALIFICACION_APROBATORIA = 70

const ESTADO_FILTRO_LABEL = {
  APROBADO: 'Aprobadas',
  REQUIERE_ATENCION: 'Requieren atención',
  PENDIENTE: 'Sin calificar',
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

// Valores guardados en el servidor, con la misma forma que un borrador.
function getServerDraft(row) {
  return {
    calificacionManual: row.calificacionManual == null ? '' : String(row.calificacionManual),
    observacion: row.observacionManual ?? '',
  }
}

function isSameDraft(a, b) {
  return a.calificacionManual === b.calificacionManual && a.observacion === b.observacion
}

// Mismo rango que valida el servidor; vacío significa "usar la calculada".
function validarCalificacion(value) {
  const text = String(value ?? '').trim()
  if (text === '') return null
  const number = Number(text)
  if (!Number.isFinite(number) || number < 1 || number > 100) return 'Debe estar entre 1 y 100'
  return null
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function normalizar(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es')
}

const byNombre = (a, b) =>
  (a.alumno?.nombre ?? '').localeCompare(b.alumno?.nombre ?? '', 'es') ||
  (a.unidad?.orden ?? 0) - (b.unidad?.orden ?? 0)

// Se ordena con los valores guardados para que las filas no salten mientras
// el docente escribe.
const ORDENES = {
  nombre: { label: 'Nombre', compare: byNombre },
  control: {
    label: 'No. control',
    compare: (a, b) =>
      (a.alumno?.numeroControl ?? '').localeCompare(b.alumno?.numeroControl ?? '', 'es', { numeric: true }) || byNombre(a, b),
  },
  menor: {
    label: 'Calificación: menor primero',
    compare: (a, b) => (getCalificacionFinal(a) ?? Infinity) - (getCalificacionFinal(b) ?? Infinity) || byNombre(a, b),
  },
  mayor: {
    label: 'Calificación: mayor primero',
    compare: (a, b) => (getCalificacionFinal(b) ?? -Infinity) - (getCalificacionFinal(a) ?? -Infinity) || byNombre(a, b),
  },
}

// Igual que el nombre que arma el servidor, que el navegador no deja leer
// porque la API no expone Content-Disposition.
function nombreExportacion(reporte, materiaId) {
  return [
    'calificaciones',
    reporte?.materia?.clave ?? `materia-${materiaId}`,
    reporte?.unidadSeleccionada?.orden ? `unidad-${reporte.unidadSeleccionada.orden}` : 'unidades',
    reporte?.grupoSeleccionado?.nombre,
  ]
    .filter(Boolean)
    .map(normalizar)
    .join('-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

const FIELD_LABEL = 'text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'
const FIELD_INPUT = 'rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-background'

function SelectField({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="flex min-w-[12rem] flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      <select value={value} onChange={onChange} disabled={disabled} className={FIELD_INPUT}>
        {children}
      </select>
    </label>
  )
}

function NumberField({ label, value, onChange, min = 0, max = 100, disabled = false }) {
  return (
    <label className="flex min-w-[8rem] flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={FIELD_INPUT}
      />
    </label>
  )
}

function MetricCard({ icon, label, value, tone = 'slate', onClick, pressed = false }) {
  const Icon = icon
  const tones = {
    blue: "border-border bg-accent text-primary-ink",
    green: "border-success/30 bg-success/10 text-success-foreground",
    amber: "border-warning/30 bg-warning/10 text-warning-foreground",
    slate: "border-border bg-background text-foreground",
  }
  const content = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value ?? '-'}</p>
      </div>
      <div className="rounded-2xl bg-card/80 p-3">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
  const className = `rounded-3xl border p-5 ${tones[tone] || tones.slate}`

  if (!onClick) return <div className={className}>{content}</div>

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${className} text-left outline-none transition hover:shadow-[0_6px_20px_oklch(0.62_0.19_264/0.08)] focus-visible:ring-2 focus-visible:ring-ring/40 ${pressed ? 'ring-2 ring-ring' : ''}`}
    >
      {content}
    </button>
  )
}

function EmptyState({ children }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function CalificacionesTable({ rows, showMateria = false }) {
  if (!rows.length) return <EmptyState>Sin calificaciones disponibles.</EmptyState>

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
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Observación</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Tareas</th>
              <th className="px-4 py-3">Asistencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((row) => (
              <tr key={getRowKey(row)}>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{row.alumno?.numeroControl || '-'}</td>
                <td className="min-w-[14rem] px-4 py-3 font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <SexoBadge sexo={row.alumno?.sexo} />
                    {row.alumno?.nombre}
                  </span>
                </td>
                {showMateria && (
                  <td className="min-w-[14rem] px-4 py-3">
                    <p className="font-medium text-foreground">{row.materia?.nombre}</p>
                    <p className="text-xs text-muted-foreground">{row.materia?.clave}</p>
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3">{row.grupo?.nombre || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.unidad?.nombre || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="text-lg font-semibold text-foreground">{formatGrade(getCalificacionFinal(row))}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{getFuenteLabel(row.fuenteCalificacion)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-medium text-foreground">{formatGrade(row.calificacionCalculada)}</span>
                  {typeof row.promedioTareas === 'number' && (
                    <p className="text-xs text-muted-foreground">Tareas {row.promedioTareas}</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {getFuenteLabel(row.fuenteCalificacion)}
                </td>
                <td className="min-w-[16rem] px-4 py-3 text-muted-foreground">
                  {row.observacionManual || row.observaciones?.[0] || '-'}
                </td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Enter baja al siguiente alumno de la misma columna y Shift+Enter sube, como
// en una hoja de cálculo. Funciona igual en la tabla, la matriz y las tarjetas.
function moverFoco(event) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const { columna } = event.currentTarget.dataset
  const grupo = event.currentTarget.closest('[data-captura-grupo]')
  const inputs = [...grupo.querySelectorAll(`input[data-captura="calificacion"][data-columna="${columna}"]:not(:disabled)`)]
  const next = inputs[inputs.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)]
  if (next) {
    next.focus()
    next.select()
  }
}

function unidadKey(unidad) {
  return unidad?.id ?? `orden-${unidad?.orden}`
}

// Nombre accesible de la celda; con varias unidades a la vista, el nombre del
// alumno solo no basta para distinguir los campos.
function etiquetaCelda(row, conUnidad) {
  const nombre = row.alumno?.nombre ?? 'alumno'
  return conUnidad && row.unidad?.nombre ? `${nombre} en ${row.unidad.nombre}` : nombre
}

// Lo que valdría la celda si se guardara ahora: la captura válida o, si está
// vacía, la calculada.
function valorEfectivo(row, draft) {
  const manual = draft.calificacionManual.trim()
  if (manual === '') return row.calificacionCalculada ?? null
  return validarCalificacion(manual) ? null : Number(manual)
}

function promedio(values) {
  const numbers = values.filter((value) => typeof value === 'number')
  return numbers.length ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1)) : null
}

function agruparPorAlumno(rows) {
  const alumnos = new Map()
  for (const row of rows) {
    const id = row.alumno?.id
    if (!alumnos.has(id)) alumnos.set(id, { alumno: row.alumno, grupo: row.grupo, celdas: {} })
    alumnos.get(id).celdas[unidadKey(row.unidad)] = row
  }
  // `calificacionFinal` con el promedio guardado permite reutilizar ORDENES.
  return [...alumnos.values()].map((item) => ({
    ...item,
    calificacionFinal: promedio(Object.values(item.celdas).map(getCalificacionFinal)),
  }))
}

function CalificacionInput({ row, drafts, conUnidad, columna, compact = false, onDraftChange }) {
  const rowKey = getRowKey(row)
  const etiqueta = etiquetaCelda(row, conUnidad)
  const dirty = Boolean(drafts[rowKey])
  const draft = drafts[rowKey] ?? getServerDraft(row)
  const manual = draft.calificacionManual.trim() !== ''
  const invalid = validarCalificacion(draft.calificacionManual)
  const calculada = row.calificacionCalculada
  const hintId = `calificacion-${rowKey}`

  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          data-captura="calificacion"
          data-columna={columna}
          aria-label={`Calificación de ${etiqueta}`}
          aria-describedby={hintId}
          aria-invalid={Boolean(invalid)}
          title={calculada == null ? undefined : `Calculada: ${calculada}`}
          type="number"
          inputMode="numeric"
          min="1"
          max="100"
          value={draft.calificacionManual}
          placeholder={calculada == null ? '-' : String(calculada)}
          disabled={!row.unidad?.id}
          onChange={(event) => onDraftChange(row, 'calificacionManual', event.target.value)}
          onKeyDown={moverFoco}
          className={`${compact ? 'w-20' : 'w-24'} rounded-2xl border border-border bg-card px-3 py-2 text-base font-semibold text-foreground outline-none transition placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-background ${dirty ? 'border-warning' : ''}`}
        />
        {compact && manual && (
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => onDraftChange(row, 'calificacionManual', '')}
            aria-label={`Usar la calificación calculada para ${etiqueta}`}
            title="Usar la calculada"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        )}
      </div>
      <div id={hintId} className="mt-1 flex flex-wrap items-center gap-x-1 text-xs">
        {invalid ? (
          <span className="font-medium text-destructive-foreground">{compact ? '1 a 100' : invalid}</span>
        ) : manual ? (
          <>
            <span className="font-medium text-foreground">Manual</span>
            {!compact && <span className="text-muted-foreground">· calculada {formatGrade(calculada)}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">{calculada == null ? 'Sin datos' : 'Calculada'}</span>
        )}
        {dirty && <span className="font-medium text-warning-foreground">· Sin guardar</span>}
      </div>
      {!compact && manual && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => onDraftChange(row, 'calificacionManual', '')}
          aria-label={`Usar la calificación calculada para ${etiqueta}`}
          className="mt-1 -ml-2 text-xs"
        >
          <RotateCcw aria-hidden="true" />
          Usar calculada
        </Button>
      )}
    </div>
  )
}

function ObservacionInput({ row, drafts, conUnidad, onDraftChange }) {
  const draft = drafts[getRowKey(row)] ?? getServerDraft(row)
  return (
    <input
      aria-label={`Observación de ${etiquetaCelda(row, conUnidad)}`}
      type="text"
      value={draft.observacion}
      disabled={!row.unidad?.id}
      onChange={(event) => onDraftChange(row, 'observacion', event.target.value)}
      className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-background"
      placeholder="Observación opcional"
      maxLength={180}
    />
  )
}

function resumenAvance(row) {
  const tareas = `Tareas ${row.tareas?.calificadas ?? 0}/${row.tareas?.total ?? 0}`
  const promedioTareas = typeof row.promedioTareas === 'number' ? ` (prom. ${row.promedioTareas})` : ''
  return `${tareas}${promedioTareas} · Asistencia ${row.asistencia?.porcentaje ?? 0}%`
}

function PromedioBadge({ value }) {
  if (value == null) return <span className="text-muted-foreground">-</span>
  return (
    <span className={`text-base font-semibold ${value >= CALIFICACION_APROBATORIA ? 'text-success-foreground' : 'text-warning-foreground'}`}>
      {value}
    </span>
  )
}

function CapturaTable({ rows, drafts, showGrupo, showUnidad, onDraftChange }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de calificaciones">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-background text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">No. control</th>
              <th className="px-4 py-3">Alumno</th>
              {showGrupo && <th className="px-4 py-3">Grupo</th>}
              {showUnidad && <th className="px-4 py-3">Unidad</th>}
              <th className="px-4 py-3">Calificación</th>
              <th className="px-4 py-3">Observación</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Tareas</th>
              <th className="px-4 py-3">Asistencia</th>
            </tr>
          </thead>
          <tbody data-captura-grupo className="divide-y divide-border text-foreground">
            {rows.map((row) => {
              const rowKey = getRowKey(row)
              return (
                <tr key={rowKey} className={drafts[rowKey] ? 'bg-warning/5' : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">{row.alumno?.numeroControl || '-'}</td>
                  <td className="min-w-[14rem] px-4 py-3 align-top font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <SexoBadge sexo={row.alumno?.sexo} />
                      {row.alumno?.nombre}
                    </span>
                  </td>
                  {showGrupo && <td className="whitespace-nowrap px-4 py-3 align-top">{row.grupo?.nombre || '-'}</td>}
                  {showUnidad && <td className="whitespace-nowrap px-4 py-3 align-top">{row.unidad?.nombre || '-'}</td>}
                  <td className="min-w-[11rem] px-4 py-3 align-top">
                    <CalificacionInput row={row} drafts={drafts} conUnidad={showUnidad} columna="lista" onDraftChange={onDraftChange} />
                  </td>
                  <td className="min-w-[12rem] px-4 py-3 align-top">
                    <ObservacionInput row={row} drafts={drafts} conUnidad={showUnidad} onDraftChange={onDraftChange} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <StatusBadge estado={row.estado} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                    {row.tareas?.calificadas ?? 0}/{row.tareas?.total ?? 0} calificadas
                    {typeof row.promedioTareas === 'number' && <p className="text-xs">Promedio {row.promedioTareas}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
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

// En teléfono una tabla de 9 columnas obliga a desplazarse de lado; cada
// alumno pasa a ser una tarjeta con lo necesario para capturar.
function CapturaCards({ rows, drafts, showGrupo, showUnidad, onDraftChange }) {
  return (
    <ul data-captura-grupo className="space-y-3" aria-label="Lista de calificaciones">
      {rows.map((row) => {
        const rowKey = getRowKey(row)
        const detalle = [row.alumno?.numeroControl, showUnidad && row.unidad?.nombre, showGrupo && row.grupo?.nombre].filter(Boolean).join(' · ')
        return (
          <li key={rowKey} className={`rounded-3xl border p-4 ${drafts[rowKey] ? 'border-warning/40 bg-warning/5' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <SexoBadge sexo={row.alumno?.sexo} />
                  {row.alumno?.nombre}
                </p>
                {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
              </div>
              <StatusBadge estado={row.estado} />
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <CalificacionInput row={row} drafts={drafts} conUnidad={showUnidad} columna="lista" onDraftChange={onDraftChange} />
              <ObservacionInput row={row} drafts={drafts} conUnidad={showUnidad} onDraftChange={onDraftChange} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{resumenAvance(row)}</p>
          </li>
        )
      })}
    </ul>
  )
}

// Filas = alumnos, columnas = unidades. Sólo captura calificaciones; las
// observaciones se escriben en la vista de lista.
function MatrizTable({ alumnos, unidades, drafts, showGrupo, onDraftChange }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Matriz de calificaciones">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-background text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-[1] bg-background px-4 py-3">Alumno</th>
              {showGrupo && <th className="px-4 py-3">Grupo</th>}
              {unidades.map((unidad) => <th key={unidadKey(unidad)} className="px-3 py-3">{unidad.nombre}</th>)}
              <th className="px-4 py-3">Promedio</th>
            </tr>
          </thead>
          <tbody data-captura-grupo className="divide-y divide-border text-foreground">
            {alumnos.map((item) => {
              const celdas = unidades.map((unidad) => item.celdas[unidadKey(unidad)])
              return (
                <tr key={item.alumno?.id}>
                  <th scope="row" className="sticky left-0 z-[1] min-w-[12rem] bg-card px-4 py-3 text-left align-top font-medium">
                    <span className="flex items-center gap-2">
                      <SexoBadge sexo={item.alumno?.sexo} />
                      {item.alumno?.nombre}
                    </span>
                    <p className="text-xs font-normal text-muted-foreground">{item.alumno?.numeroControl}</p>
                  </th>
                  {showGrupo && <td className="whitespace-nowrap px-4 py-3 align-top">{item.grupo?.nombre || '-'}</td>}
                  {unidades.map((unidad, index) => (
                    <td key={unidadKey(unidad)} className="min-w-[8.5rem] px-3 py-3 align-top">
                      {celdas[index] ? (
                        <CalificacionInput row={celdas[index]} drafts={drafts} conUnidad columna={String(unidadKey(unidad))} compact onDraftChange={onDraftChange} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <PromedioBadge value={promedio(celdas.filter(Boolean).map((row) => valorEfectivo(row, drafts[getRowKey(row)] ?? getServerDraft(row))))} />
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

function MatrizCards({ alumnos, unidades, drafts, showGrupo, onDraftChange }) {
  return (
    <ul data-captura-grupo className="space-y-3" aria-label="Matriz de calificaciones">
      {alumnos.map((item) => {
        const celdas = unidades.map((unidad) => item.celdas[unidadKey(unidad)])
        const dirty = celdas.some((row) => row && drafts[getRowKey(row)])
        const detalle = [item.alumno?.numeroControl, showGrupo && item.grupo?.nombre].filter(Boolean).join(' · ')
        return (
          <li key={item.alumno?.id} className={`rounded-3xl border p-4 ${dirty ? 'border-warning/40 bg-warning/5' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <SexoBadge sexo={item.alumno?.sexo} />
                  {item.alumno?.nombre}
                </p>
                {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
              </div>
              <p className="text-right text-xs text-muted-foreground">
                Promedio
                <span className="block">
                  <PromedioBadge value={promedio(celdas.filter(Boolean).map((row) => valorEfectivo(row, drafts[getRowKey(row)] ?? getServerDraft(row))))} />
                </span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
              {unidades.map((unidad, index) => (
                <div key={unidadKey(unidad)}>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{unidad.nombre}</p>
                  {celdas[index] ? (
                    <CalificacionInput row={celdas[index]} drafts={drafts} conUnidad columna={String(unidadKey(unidad))} compact onDraftChange={onDraftChange} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DocenteCalificaciones() {
  const {
    reporteDocente,
    loading,
    error,
    obtenerDocente,
    exportarCaptura,
    guardarLote,
    guardarPonderacion,
  } = useCalificacionStore()
  const [materias, setMaterias] = useState([])
  // Los filtros viven en la URL para que el docente vuelva al mismo grupo y
  // unidad al regresar o recargar.
  const [searchParams, setSearchParams] = useSearchParams()
  const materiaParam = searchParams.get('materia') ?? ''
  const grupoParam = searchParams.get('grupo') ?? ''
  const unidadParam = searchParams.get('unidad') ?? ''
  const vistaParam = searchParams.get('vista') === 'matriz' ? 'matriz' : 'lista'
  const isMobile = useIsMobile()
  const filters = useMemo(
    () => ({ materiaId: materiaParam, grupoId: grupoParam, unidadId: unidadParam }),
    [materiaParam, grupoParam, unidadParam],
  )
  const reportQuery = useMemo(() => ({
    materiaId: filters.materiaId,
    grupoId: filters.grupoId || undefined,
    unidadId: filters.unidadId || undefined,
  }), [filters])
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('nombre')
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)
  // La ponderación se guarda en la materia (servidor); aquí sólo el borrador.
  const [weights, setWeights] = useState({ pesoTareas: '', pesoAsistencia: '' })
  const [savingWeights, setSavingWeights] = useState(false)
  const [weightsNotice, setWeightsNotice] = useState('')

  useEffect(() => {
    api.get('/materias/mis-materias')
      .then((response) => setMaterias(response.data || []))
      .catch(() => setMaterias([]))
  }, [])

  // Con una sola materia no tiene sentido obligar a elegirla.
  useEffect(() => {
    if (!filters.materiaId && materias.length === 1) {
      setSearchParams({ materia: String(materias[0].id) }, { replace: true })
    }
  }, [materias, filters.materiaId, setSearchParams])

  useEffect(() => {
    if (!reportQuery.materiaId) return
    obtenerDocente(reportQuery).catch(() => {})
  }, [reportQuery, obtenerDocente])

  const ponderacion = filters.materiaId ? reporteDocente?.ponderacion : null
  useEffect(() => {
    setWeights({
      pesoTareas: ponderacion ? String(ponderacion.tareas) : '',
      pesoAsistencia: ponderacion ? String(ponderacion.asistencia) : '',
    })
  }, [ponderacion])
  useEffect(() => { setWeightsNotice('') }, [filters.materiaId])

  // Al escribir un peso se completa el otro para que siempre sumen 100.
  const handleWeightChange = (field) => (event) => {
    const { value } = event.target
    const other = field === 'pesoTareas' ? 'pesoAsistencia' : 'pesoTareas'
    const number = Number(value)
    const complemento = value !== '' && Number.isInteger(number) && number >= 0 && number <= 100
      ? { [other]: String(100 - number) }
      : {}
    setWeightsNotice('')
    setWeights((prev) => ({ ...prev, [field]: value, ...complemento }))
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
      await obtenerDocente(reportQuery, { silent: true })
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
  // Sin memoizar, el `[]` era un array nuevo en cada render y los efectos que
  // dependen de `rows` entraban en bucle.
  const rows = useMemo(
    () => (filters.materiaId ? reporteDocente?.rows ?? [] : []),
    [filters.materiaId, reporteDocente?.rows],
  )
  const metrics = filters.materiaId ? reporteDocente?.metrics ?? {} : {}
  const canExport = Boolean(filters.materiaId)

  const coincideBusqueda = useMemo(() => {
    const query = normalizar(busqueda.trim())
    return (alumno) => !query || normalizar(`${alumno?.nombre ?? ''} ${alumno?.numeroControl ?? ''}`).includes(query)
  }, [busqueda])

  const visibleRows = useMemo(
    () => rows
      .filter((row) => (!estadoFiltro || row.estado === estadoFiltro) && coincideBusqueda(row.alumno))
      .sort(ORDENES[orden].compare),
    [rows, coincideBusqueda, estadoFiltro, orden],
  )

  const unidadesReporte = useMemo(() => {
    const unidades = new Map()
    for (const row of rows) if (row.unidad) unidades.set(unidadKey(row.unidad), row.unidad)
    return [...unidades.values()].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  }, [rows])
  // La matriz sólo tiene sentido con varias unidades a la vista.
  const puedeVerMatriz = !filters.unidadId && unidadesReporte.length > 1
  const vista = puedeVerMatriz ? vistaParam : 'lista'
  // En la matriz, un alumno aparece con el filtro de estado si alguna de sus
  // unidades está en ese estado.
  const visibleAlumnos = useMemo(
    () => agruparPorAlumno(rows)
      .filter((item) => (!estadoFiltro || Object.values(item.celdas).some((row) => row.estado === estadoFiltro)) && coincideBusqueda(item.alumno))
      .sort(ORDENES[orden].compare),
    [rows, coincideBusqueda, estadoFiltro, orden],
  )
  const setVista = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'matriz') params.set('vista', 'matriz')
      else params.delete('vista')
      return params
    }, { replace: true })
  }

  // `drafts` sólo guarda las filas que el docente cambió y aún no guarda. Así,
  // cuando el servidor devuelve el reporte actualizado, los cambios pendientes
  // de las demás filas se conservan. Cuentan también las filas ocultas por la
  // búsqueda o el filtro de estado.
  const dirtyRows = useMemo(
    () => rows.filter((row) => row.unidad?.id && drafts[getRowKey(row)]),
    [rows, drafts],
  )
  const dirtyCount = dirtyRows.length
  const invalidCount = dirtyRows.filter((row) => validarCalificacion(drafts[getRowKey(row)].calificacionManual)).length
  const unsavedMessage = (accion) => ({
    title: 'Cambios sin guardar',
    description: `Tienes ${plural(dirtyCount, 'calificación', 'calificaciones')} sin guardar. Si ${accion}, se perderán.`,
    confirmLabel: 'Descartar cambios',
  })
  useUnsavedChangesGuard(dirtyCount > 0, unsavedMessage('sales de esta página'))

  const changeFilters = async (next) => {
    if (dirtyCount > 0 && !(await confirmAction(unsavedMessage('cambias el filtro')))) return
    setDrafts({})
    setEstadoFiltro(null)
    const params = { materia: next.materiaId, grupo: next.grupoId, unidad: next.unidadId, vista: vistaParam === 'matriz' ? 'matriz' : '' }
    setSearchParams(Object.fromEntries(Object.entries(params).filter(([, value]) => value)), { replace: true })
  }

  const handleExport = async (formato) => {
    if (!canExport) return
    setDownloading(formato)
    try {
      await exportarCaptura(reportQuery, formato, nombreExportacion(reporteDocente, filters.materiaId))
    } catch {
      // El store ya expone el mensaje en `error`.
    } finally {
      setDownloading(null)
    }
  }

  const handleDraftChange = useCallback((row, field, value) => {
    const rowKey = getRowKey(row)
    const serverDraft = getServerDraft(row)
    setDrafts((prev) => {
      const next = { ...serverDraft, ...prev[rowKey], [field]: value }
      if (isSameDraft(next, serverDraft)) {
        const { [rowKey]: _discarded, ...rest } = prev
        return rest
      }
      return { ...prev, [rowKey]: next }
    })
  }, [])

  const handleSaveAll = async () => {
    if (!dirtyCount || invalidCount || saving) return
    const snapshot = Object.fromEntries(dirtyRows.map((row) => [getRowKey(row), drafts[getRowKey(row)]]))
    setSaving(true)
    try {
      await guardarLote({
        materiaId: Number(filters.materiaId),
        grupoId: filters.grupoId ? Number(filters.grupoId) : undefined,
        calificaciones: dirtyRows.map((row) => {
          const draft = snapshot[getRowKey(row)]
          const manual = draft.calificacionManual.trim()
          return {
            alumnoId: row.alumno.id,
            unidadId: row.unidad.id,
            calificacionManual: manual === '' ? null : Number(manual),
            observacion: draft.observacion,
          }
        }),
      }, { grupoId: reportQuery.grupoId, unidadId: reportQuery.unidadId })
      // Si el docente siguió escribiendo mientras se guardaba, se conserva lo nuevo.
      setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([key, value]) => snapshot[key] !== value)))
      notify(`Se ${dirtyCount === 1 ? 'guardó' : 'guardaron'} ${plural(dirtyCount, 'calificación', 'calificaciones')}.`, 'success')
    } catch {
      // El store ya expone el mensaje en `error`; los borradores se conservan.
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = async () => {
    const confirmed = await confirmAction({
      title: 'Descartar cambios',
      description: `Se perderán ${plural(dirtyCount, 'calificación', 'calificaciones')} sin guardar.`,
      confirmLabel: 'Descartar cambios',
    })
    if (confirmed) setDrafts({})
  }

  const toggleEstado = (estado) => setEstadoFiltro((prev) => (prev === estado ? null : estado))
  const hayFiltrosSecundarios = Boolean(filters.grupoId || filters.unidadId)
  const listaProps = {
    rows: visibleRows,
    drafts,
    showGrupo: !filters.grupoId,
    showUnidad: !filters.unidadId,
    onDraftChange: handleDraftChange,
  }
  const matrizProps = {
    alumnos: visibleAlumnos,
    unidades: unidadesReporte,
    drafts,
    showGrupo: !filters.grupoId,
    onDraftChange: handleDraftChange,
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-card px-6 py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Calificaciones</h1>
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
        {!canExport && (
          <p className="mt-4 text-sm text-muted-foreground lg:text-right">Elige una materia para exportar.</p>
        )}
        {dirtyCount > 0 && (
          <p className="mt-4 text-sm text-warning-foreground lg:text-right">
            La exportación usa las calificaciones guardadas; no incluye tus {plural(dirtyCount, 'cambio', 'cambios')} sin guardar.
          </p>
        )}
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
            onChange={(event) => changeFilters({ materiaId: event.target.value, grupoId: '', unidadId: '' })}
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
            onChange={(event) => changeFilters({ ...filters, grupoId: event.target.value })}
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
            onChange={(event) => changeFilters({ ...filters, unidadId: event.target.value })}
          >
            <option value="">Todas las unidades</option>
            {(selectedMateria?.unidades ?? []).map((unidad) => (
              <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
            ))}
          </SelectField>

          <Button variant="outline"
            type="button"
            disabled={!hayFiltrosSecundarios}
            onClick={() => changeFilters({ ...filters, grupoId: '', unidadId: '' })}
            className="mt-auto inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold"
          >
            <RefreshCcw className="h-4 w-4" />
            Limpiar grupo y unidad
          </Button>
        </div>
      </section>

      {ponderacion && (
        <details className="group rounded-[2rem] border border-border bg-card p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-foreground [&::-webkit-details-marker]:hidden">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-[0.14em]">Ponderación</span>
            <span className="text-sm text-muted-foreground">
              · Tareas {ponderacion.tareas} % · Asistencia {ponderacion.asistencia} %
            </span>
            <ChevronDown className="ml-auto h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            Se guarda en la materia y la usan por igual esta lista, las exportaciones y la vista de los alumnos.
            Al cambiarla se recalculan las calificaciones calculadas; las que capturaste a mano no cambian.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <NumberField label="Tareas %" value={weights.pesoTareas} onChange={handleWeightChange('pesoTareas')} />
            <NumberField label="Asistencia %" value={weights.pesoAsistencia} onChange={handleWeightChange('pesoAsistencia')} />
            <Button variant="default"
              type="button"
              disabled={!weightsDirty || weightsSum !== 100 || savingWeights}
              onClick={handleSaveWeights}
              className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingWeights ? 'Guardando...' : 'Guardar ponderación'}
            </Button>
          </div>
          {weightsSum !== 100 && (
            <p role="alert" className="mt-2 text-sm text-destructive-foreground">Tareas y asistencia deben sumar 100 % (ahora suman {weightsSum} %).</p>
          )}
          {weightsNotice && <p role="status" className="mt-2 text-sm text-muted-foreground">{weightsNotice}</p>}
        </details>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {Array.isArray(error) ? error.join(', ') : error}
        </div>
      )}

      {filters.materiaId && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen">
          <MetricCard icon={GraduationCap} label="Promedio" value={formatGrade(metrics.promedioGeneral)} tone="slate" />
          <MetricCard icon={CheckCircle2} label="Aprobadas" value={metrics.aprobadas ?? 0} tone="green"
            pressed={estadoFiltro === 'APROBADO'} onClick={() => toggleEstado('APROBADO')} />
          <MetricCard icon={AlertTriangle} label="Requieren atención" value={metrics.requiereAtencion ?? 0} tone="amber"
            pressed={estadoFiltro === 'REQUIERE_ATENCION'} onClick={() => toggleEstado('REQUIERE_ATENCION')} />
          <MetricCard icon={CircleDashed} label="Sin calificar" value={metrics.pendientes ?? 0} tone="blue"
            pressed={estadoFiltro === 'PENDIENTE'} onClick={() => toggleEstado('PENDIENTE')} />
        </section>
      )}

      <section className="rounded-[2rem] border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Lista para captura</h2>
            {filters.materiaId && typeof metrics.totalAlumnos === 'number' && (
              <p className="text-sm text-muted-foreground">{plural(metrics.totalAlumnos, 'alumno', 'alumnos')}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Aprobado: {CALIFICACION_APROBATORIA} o más · Requiere atención: menos de {CALIFICACION_APROBATORIA} · Pendiente: sin datos
          </p>
        </div>

        {filters.materiaId && rows.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-1 flex-col gap-1 sm:min-w-[16rem]">
              <span className={FIELD_LABEL}>Buscar alumno</span>
              <span className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Nombre o no. control"
                  className={`${FIELD_INPUT} w-full pl-10`}
                />
              </span>
            </label>
            <SelectField label="Ordenar por" value={orden} onChange={(event) => setOrden(event.target.value)}>
              {Object.entries(ORDENES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelectField>
            {puedeVerMatriz && (
              <div className="flex flex-col gap-1">
                <span className={FIELD_LABEL} id="vista-captura">Vista</span>
                <div role="group" aria-labelledby="vista-captura" className="inline-flex rounded-2xl border border-border bg-background p-1">
                  {[['lista', 'Lista'], ['matriz', 'Por alumno']].map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={vista === value ? 'default' : 'ghost'}
                      aria-pressed={vista === value}
                      onClick={() => setVista(value)}
                      className="rounded-xl px-3"
                    >
                      {value === 'lista' ? <List aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {estadoFiltro && (
              <Button variant="outline" type="button" onClick={() => setEstadoFiltro(null)} className="self-start sm:self-auto">
                Mostrando: {ESTADO_FILTRO_LABEL[estadoFiltro]}
                <X aria-hidden="true" />
                <span className="sr-only">(quitar filtro)</span>
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <EmptyState>Cargando calificaciones...</EmptyState>
        ) : !filters.materiaId ? (
          <EmptyState>Selecciona una materia para generar la lista.</EmptyState>
        ) : !rows.length ? (
          <EmptyState>Sin calificaciones disponibles.</EmptyState>
        ) : !(vista === 'matriz' ? visibleAlumnos : visibleRows).length ? (
          <EmptyState>Ningún alumno coincide con la búsqueda o el filtro.</EmptyState>
        ) : vista === 'matriz' ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Las observaciones se escriben en la vista de lista. El promedio se actualiza mientras capturas.
            </p>
            {isMobile ? <MatrizCards {...matrizProps} /> : <MatrizTable {...matrizProps} />}
          </>
        ) : isMobile ? (
          <CapturaCards {...listaProps} />
        ) : (
          <CapturaTable {...listaProps} />
        )}

        {dirtyCount > 0 && (
          <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground">
              {plural(dirtyCount, 'cambio', 'cambios')} sin guardar
              {invalidCount > 0 && (
                <span className="text-destructive-foreground"> · corrige {plural(invalidCount, 'calificación', 'calificaciones')} fuera de rango</span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" type="button" disabled={saving} onClick={handleDiscard}>Descartar</Button>
              <Button type="button" disabled={saving || invalidCount > 0} onClick={handleSaveAll}>
                <Save aria-hidden="true" />
                {saving ? 'Guardando...' : 'Guardar todo'}
              </Button>
            </div>
          </div>
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
