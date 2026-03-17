import { useState } from 'react'
import { useParams } from 'react-router-dom'
import TablaAsistenciasAlumno from './components/TablaAsistenciasAlumno'
import { useTareaStore } from '../../store/tareaStore'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const ESTADO_TAREA = {
  null: { label: 'Sin entregar', style: 'bg-gray-100 text-gray-600' },
  PENDIENTE: { label: 'Entregada', style: 'bg-blue-100 text-blue-700' },
  REVISADA: { label: 'Revisada', style: 'bg-yellow-100 text-yellow-700' },
  CALIFICADA: { label: 'Calificada', style: 'bg-green-100 text-green-700' },
  INCORRECTA: { label: 'Incorrecta', style: 'bg-red-100 text-red-700' },
}

export default function MateriaDetalleAlumno() {
  const { id } = useParams()
  const [tab, setTab] = useState('asistencias')
  const { misEntregas, obtenerMisTareas, loading } = useTareaStore()

  useEffect(() => {
    if (tab === 'tareas') obtenerMisTareas(Number(id))
  }, [tab, id])

  const byUnidad = misEntregas.reduce((acc, item) => {
    const k = `Unidad ${item.tarea.unidad}`
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})

  return (
    <div className="p-6">
      <div className="flex gap-1 mb-6 border-b">
        {['asistencias', 'tareas'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
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
                  {items.map(({ tarea, miEntrega }) => {
                    const estado = miEntrega?.estadoRevision ?? null
                    const { label, style } = ESTADO_TAREA[estado] || ESTADO_TAREA[null]
                    return (
                      <div key={tarea.id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{tarea.titulo}</p>
                          <p className="text-xs text-gray-500">
                            Límite: {new Date(tarea.fechaLimite).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {miEntrega?.calificacion != null && (
                            <span className="font-bold text-green-700 text-sm">{miEntrega.calificacion}/100</span>
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
