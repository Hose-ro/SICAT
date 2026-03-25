import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { useClaseStore } from '../store/claseStore'
import { useAsistenciaStore } from '../store/asistenciaStore'
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
            disabled={Boolean(clase.sesion?.id)}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clase.sesion?.id ? 'Clase iniciada' : 'Iniciar clase'}
          </button>
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
            onClick={() => onIniciarUnidad(unidadPendiente.id)}
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

function FiltroToolbar({
  filters,
  onChange,
  onApply,
  materias = [],
  grupos = [],
  unidades = [],
  docentes = [],
  showDocente = false,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {showDocente && (
          <select
            value={filters.docenteId}
            onChange={(event) => onChange('docenteId', event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
          >
            <option value="">Todos los docentes</option>
            {docentes.map((docente) => (
              <option key={docente.id} value={docente.id}>{docente.nombre}</option>
            ))}
          </select>
        )}

        <select
          value={filters.materiaId}
          onChange={(event) => onChange('materiaId', event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
        >
          <option value="">Todas las materias</option>
          {materias.map((materia) => (
            <option key={materia.id} value={materia.id}>{materia.nombre}</option>
          ))}
        </select>

        <select
          value={filters.grupoId}
          onChange={(event) => onChange('grupoId', event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
        >
          <option value="">Todos los grupos</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
          ))}
        </select>

        <select
          value={filters.unidadId}
          onChange={(event) => onChange('unidadId', event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
        >
          <option value="">Todas las unidades</option>
          {unidades.map((unidad) => (
            <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.fecha}
          onChange={(event) => onChange('fecha', event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
        />

        <input
          type="date"
          value={filters.semana}
          onChange={(event) => onChange('semana', event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
        />
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
  const [materiaDetalle, setMateriaDetalle] = useState(null)

  const cargarTodo = async (nextFilters = filters) => {
    await Promise.all([
      cargarPanelDocente(),
      obtenerHistorial(nextFilters),
    ])
  }

  useEffect(() => {
    cargarTodo()
    const interval = setInterval(() => {
      cargarPanelDocente().catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!filters.materiaId) {
      setMateriaDetalle(null)
      return
    }

    api.get(`/materias/${filters.materiaId}`)
      .then((response) => setMateriaDetalle(response.data))
      .catch(() => setMateriaDetalle(null))
  }, [filters.materiaId])

  const clasesHoy = panelDocente?.clasesHoy ?? []
  const clasePrincipal = panelDocente?.claseActual ?? panelDocente?.proximaClase ?? null

  const materiasMap = new Map()
  clasesHoy.forEach((clase) => {
    if (clase.materia) materiasMap.set(clase.materia.id, { id: clase.materia.id, nombre: clase.materia.nombre })
  })
  historial.forEach((item) => {
    if (item.materia) materiasMap.set(item.materia.id, { id: item.materia.id, nombre: item.materia.nombre })
  })
  const materias = Array.from(materiasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const gruposMap = new Map()
  clasesHoy.forEach((clase) => {
    if (clase.grupo) gruposMap.set(clase.grupo.id, { id: clase.grupo.id, nombre: clase.grupo.nombre })
  })
  historial.forEach((item) => {
    if (item.grupo) gruposMap.set(item.grupo.id, { id: item.grupo.id, nombre: item.grupo.nombre })
  })
  const grupos = Array.from(gruposMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const unidades = materiaDetalle?.unidades ?? []

  const handleStartClass = async (clase) => {
    setMensaje('')
    try {
      const response = await iniciar({ horarioId: clase.horarioId })
      setSelectedSessionId(response.id)
      if (response.advertencia) setMensaje(response.advertencia)
      await cargarTodo()
    } catch (error) {
      setMensaje(error.response?.data?.message || 'No se pudo iniciar la clase.')
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

  const handleIniciarUnidad = async (unidadId) => {
    setMensaje('')
    try {
      await api.patch(`/unidades/${unidadId}/iniciar`)
      await cargarTodo()
    } catch (error) {
      setMensaje(error.response?.data?.message || 'No se pudo iniciar la unidad.')
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
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fecha' && value) next.semana = ''
      if (key === 'semana' && value) next.fecha = ''
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
      api.get('/materias'),
      api.get('/grupos'),
      obtenerHistorial({}),
    ])
      .then(([docentesRes, materiasRes, gruposRes]) => {
        setDocentes(docentesRes.data)
        setMaterias(materiasRes.data)
        setGrupos(gruposRes.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!filters.materiaId) {
      setMateriaDetalle(null)
      return
    }

    api.get(`/materias/${filters.materiaId}`)
      .then((response) => setMateriaDetalle(response.data))
      .catch(() => setMateriaDetalle(null))
  }, [filters.materiaId])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fecha' && value) next.semana = ''
      if (key === 'semana' && value) next.fecha = ''
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
        unidades={materiaDetalle?.unidades ?? []}
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

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">Asistencias</h1>
      <p className="max-w-2xl text-sm text-slate-600">
        La captura y administración de asistencias está disponible para docentes y administración. Como alumno puedes consultar tus registros por materia desde el detalle de cada curso.
      </p>
      <Link
        to="/materias"
        className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Ir a mis materias
      </Link>
    </div>
  )
}
