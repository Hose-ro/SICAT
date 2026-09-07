import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import UnidadesCard from './materia/UnidadesCard'
import AlumnosMateriaCard from './materia/AlumnosMateriaCard'

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function MateriaDetalle() {
  const { id } = useParams()
  const { user } = useAuthStore()
  // El backend ya limita al docente a las materias que imparte: si abrió la
  // página, la materia es suya.
  const puedeGestionar = user?.rol === 'ADMIN' || user?.rol === 'DOCENTE'
  const [materia, setMateria] = useState(null)
  const [historial, setHistorial] = useState([])
  const [tareas, setTareas] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function cargarDetalle() {
      setLoading(true)
      setError('')

      try {
        const [materiaRes, historialRes, tareasRes] = await Promise.all([
          api.get(`/materias/${id}`),
          api.get('/asistencias/historial', { params: { materiaId: id } }),
          api.get(`/tareas/materia/${id}`),
        ])

        if (!active) return

        setMateria(materiaRes.data)
        setHistorial(historialRes.data?.items ?? [])
        setEstadisticas(historialRes.data?.estadisticas ?? null)
        setTareas(tareasRes.data ?? [])
      } catch (err) {
        if (!active) return
        setError(err.response?.data?.message ?? 'No se pudo cargar la materia')
      } finally {
        if (active) setLoading(false)
      }
    }

    cargarDetalle()
    return () => {
      active = false
    }
  }, [id])

  /** Tras cambiar unidades o el padrón basta con releer la materia. */
  const recargarMateria = useCallback(async () => {
    const { data } = await api.get(`/materias/${id}`)
    setMateria(data)
  }, [id])

  const resumen = useMemo(() => ({
    unidades: materia?.unidades?.length ?? 0,
    alumnos: materia?.inscripciones?.length ?? 0,
    clases: historial.length,
    tareas: tareas.length,
  }), [historial.length, materia?.inscripciones?.length, materia?.unidades?.length, tareas.length])

  if (loading) {
    return <div className="py-16 text-center text-sm text-gray-500">Cargando materia...</div>
  }

  if (error || !materia) {
    return <div className="py-16 text-center text-sm text-red-500">{error || 'Materia no encontrada'}</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={materia.nombre}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold text-blue-600">{materia.clave}</span>
            <span>{materia.carrera?.nombre ?? 'Sin carrera'}</span>
            <span>{materia.semestre ? `Semestre ${materia.semestre}` : 'Semestre sin asignar'}</span>
            <span>{materia.docente?.nombre ? `Docente: ${materia.docente.nombre}` : 'Docente pendiente'}</span>
          </div>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/asistencias"
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Ver asistencias
            </Link>
            <Link
              to="/tareas"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Ver tareas
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Unidades', resumen.unidades],
          ['Alumnos activos', resumen.alumnos],
          ['Clases registradas', resumen.clases],
          ['Tareas creadas', resumen.tareas],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          </article>
        ))}
      </section>

      {estadisticas && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Resumen de asistencias</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">A: {estadisticas.asistencias ?? 0}</span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">F: {estadisticas.faltas ?? 0}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">R: {estadisticas.retardos ?? 0}</span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">J: {estadisticas.justificados ?? 0}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">%: {estadisticas.porcentaje ?? 0}</span>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <UnidadesCard
          materia={materia}
          puedeEditar={puedeGestionar}
          onActualizado={recargarMateria}
        />
        <AlumnosMateriaCard
          materia={materia}
          puedeEditar={puedeGestionar}
          onActualizado={recargarMateria}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Sesiones recientes</h3>
            <span className="text-xs text-gray-400">{historial.length} registro(s)</span>
          </div>
          <div className="mt-4 space-y-3">
            {historial.slice(0, 8).map((sesion) => (
              <div key={sesion.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800">{sesion.grupo?.nombre ?? 'Sin grupo'} · {sesion.unidad?.nombre ?? 'Sin unidad'}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(sesion.fecha)} · Semana {sesion.semanaClave}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">A {sesion.resumen?.asistencias ?? 0}</span>
                    <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-700">F {sesion.resumen?.faltas ?? 0}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">R {sesion.resumen?.retardos ?? 0}</span>
                  </div>
                </div>
              </div>
            ))}
            {historial.length === 0 && (
              <p className="text-sm text-gray-400">No hay sesiones registradas todavía.</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Tareas recientes</h3>
            <span className="text-xs text-gray-400">{tareas.length} tarea(s)</span>
          </div>
          <div className="mt-4 space-y-3">
            {tareas.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{item.titulo}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.unidadRef?.nombre ?? 'Sin unidad'} · {item.tieneFechaLimite ? `Límite ${formatDate(item.fechaLimite)}` : 'Sin límite'}
                    </p>
                  </div>
                  <Link
                    to={`/docente/tareas/${item.id}`}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-white"
                  >
                    Ver tarea
                  </Link>
                </div>
              </div>
            ))}
            {tareas.length === 0 && (
              <p className="text-sm text-gray-400">No hay tareas publicadas para esta materia.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
