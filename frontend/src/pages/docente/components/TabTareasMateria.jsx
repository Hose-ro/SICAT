import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTareaStore } from '../../../store/tareaStore'

export default function TabTareasMateria({ materiaId }) {
  const { tareas, obtenerPorMateria, desactivar, loading } = useTareaStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { obtenerPorMateria(materiaId) }, [materiaId])

  const byUnidad = tareas.reduce((acc, t) => {
    const k = t.unidadRef?.nombre || 'Sin unidad'
    if (!acc[k]) acc[k] = []
    acc[k].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link to={`/docente/tareas/crear?materiaId=${materiaId}`}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          + Nueva Tarea
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : tareas.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin tareas publicadas</p>
      ) : (
        Object.entries(byUnidad).map(([unidad, tasks]) => (
          <div key={unidad}>
            <h3 className="font-semibold text-gray-700 mb-2">{unidad}</h3>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="bg-white border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{t.titulo}</p>
                    <p className="text-xs text-gray-500">
                      {t.grupo?.nombre || 'Sin grupo'} · {' '}
                      {t.tieneFechaLimite && t.fechaLimite
                        ? `Límite: ${new Date(t.fechaLimite).toLocaleDateString('es-MX')}`
                        : 'Sin límite'} ·
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                        t.tipoEntrega === 'EN_LINEA' ? 'bg-blue-100 text-blue-700' :
                        t.tipoEntrega === 'FIRMA' ? 'bg-purple-100 text-purple-700' :
                        t.tipoEntrega === 'REVISION_EN_LINEA' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{t.tipoEntrega}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{t.entregadas ?? 0}/{t.totalAlumnos ?? 0} entregas</span>
                    <span className="text-xs text-gray-500">{t.estado}</span>
                    <Link to={`/docente/tareas/${t.id}`}
                      className="text-xs text-blue-600 hover:underline">Ver</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
