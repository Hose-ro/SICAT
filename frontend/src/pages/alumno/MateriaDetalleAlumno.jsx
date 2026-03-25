import { useState } from 'react'
import { useParams } from 'react-router-dom'
import TablaAsistenciasAlumno from './components/TablaAsistenciasAlumno'
import { useTareaStore } from '../../store/tareaStore'
import { useClaseStore } from '../../store/claseStore'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const ESTADO_TAREA = {
  null: { label: 'Pendiente', style: 'bg-gray-100 text-gray-600' },
  PENDIENTE: { label: 'Pendiente', style: 'bg-slate-100 text-slate-700' },
  ENTREGADA: { label: 'Entregada', style: 'bg-blue-100 text-blue-700' },
  REVISADA: { label: 'Revisada', style: 'bg-yellow-100 text-yellow-700' },
  CALIFICADA: { label: 'Calificada', style: 'bg-green-100 text-green-700' },
  INCORRECTA: { label: 'Incorrecta', style: 'bg-red-100 text-red-700' },
  NO_ENTREGADA: { label: 'No entregada', style: 'bg-amber-100 text-amber-700' },
}

export default function MateriaDetalleAlumno() {
  const { id } = useParams()
  const [tab, setTab] = useState('asistencias')
  const { misEntregas, obtenerMisTareas, loading } = useTareaStore()
  const { misClasesActivas, obtenerMisClasesActivas } = useClaseStore()

  useEffect(() => {
    if (tab === 'tareas') obtenerMisTareas(Number(id))
  }, [tab, id])

  useEffect(() => {
    obtenerMisClasesActivas().catch(() => {})
    const interval = setInterval(() => {
      obtenerMisClasesActivas().catch(() => {})
    }, 20000)
    return () => clearInterval(interval)
  }, [id])

  const byUnidad = misEntregas.reduce((acc, item) => {
    const k = item.tarea.unidadRef?.nombre || (item.tarea.unidad ? `Unidad ${item.tarea.unidad}` : 'Sin unidad')
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})

  const claseActiva = misClasesActivas.find((clase) => clase.materiaId === Number(id))

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
      {claseActiva && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Clase en línea</p>
              <p className="text-sm text-emerald-800">
                {claseActiva.materia?.nombre} · {claseActiva.grupo?.nombre ?? 'Grupo'} · {claseActiva.horarioMateria?.aula?.nombre ?? 'Aula pendiente'}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              {claseActiva.unidadRef?.nombre ?? `Unidad ${claseActiva.unidad}`}
            </span>
          </div>
        </div>
      )}

      <div className="mb-6 overflow-x-auto border-b">
        <div className="flex w-max gap-1">
          {['asistencias', 'tareas'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'asistencias' && <TablaAsistenciasAlumno materiaId={Number(id)} />}

      {tab === 'tareas' && (
        <div>
          {loading ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : misEntregas.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin tareas</p>
          ) : (
            Object.entries(byUnidad).map(([unidad, items]) => (
              <div key={unidad} className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">{unidad}</h3>
                <div className="space-y-2">
                  {items.map(({ tarea, miEntrega, estadoAlumno }) => {
                    const estado = miEntrega?.estadoRevision ?? estadoAlumno ?? null
                    const { label, style } = ESTADO_TAREA[estado] || ESTADO_TAREA[null]
                    return (
                      <div key={tarea.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-sm">{tarea.titulo}</p>
                          <p className="text-xs text-gray-500">
                            {tarea.unidadRef?.nombre || unidad} · {tarea.tieneFechaLimite
                              ? `Límite: ${new Date(tarea.fechaLimite).toLocaleDateString('es-MX')}`
                              : 'Sin límite'}
                          </p>
                          {miEntrega?.observacion && (
                            <p className="mt-2 text-xs text-gray-500 line-clamp-2">{miEntrega.observacion}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {miEntrega?.calificacion != null && (
                            <span className="font-bold text-green-700 text-sm">{miEntrega.calificacion}/100</span>
                          )}
                          {miEntrega?.fueTardia && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Tardía</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs ${style}`}>{label}</span>
                          <Link to={`/alumno/tareas/${tarea.id}`} className="text-xs text-blue-600 hover:underline">Ver</Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
