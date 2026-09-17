import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTareaStore } from '../../../store/tareaStore'

import { TASK_STATE_LABEL, TASK_TYPE_LABEL } from '../../../lib/tareas'
import TaskNotice from '../../../components/TaskNotice'

export default function TabTareasMateria({ materiaId }) {
  const { tareas, obtenerPorMateria, loading, error } = useTareaStore()

  useEffect(() => { obtenerPorMateria(materiaId).catch(() => {}) }, [materiaId, obtenerPorMateria])

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
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary">
          + Nueva Tarea
        </Link>
      </div>

      <TaskNotice error={error} onRetry={() => obtenerPorMateria(materiaId).catch(() => {})} />
      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : tareas.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aún no hay tareas para esta materia. Crea la primera para comenzar.</p>
      ) : (
        Object.entries(byUnidad).map(([unidad, tasks]) => (
          <div key={unidad}>
            <h2 className="font-semibold text-foreground mb-2">{unidad}</h2>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="bg-card border rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                  <div>
                    <p className="font-medium text-sm">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.grupo?.nombre || 'Sin grupo'} · {' '}
                      {t.tieneFechaLimite && t.fechaLimite
                        ? `Límite: ${new Date(t.fechaLimite).toLocaleDateString('es-MX')}`
                        : 'Sin límite'} ·
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                        t.tipoEntrega === 'EN_LINEA' ? "bg-primary/10 text-primary-ink" :
                        t.tipoEntrega === 'FIRMA' ? "bg-primary/10 text-primary-ink" :
                        t.tipoEntrega === 'REVISION_EN_LINEA' ? 'bg-success/10 text-foreground' :
                        'bg-muted text-foreground'
                      }`}>{TASK_TYPE_LABEL[t.tipoEntrega] || t.tipoEntrega}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t.entregadas ?? 0}/{t.totalAlumnos ?? 0} entregas</span>
                    <span className="text-xs text-muted-foreground">{TASK_STATE_LABEL[t.estado] || t.estado}</span>
                    <Link to={`/docente/tareas/${t.id}`}
                      className="text-xs text-primary-ink hover:underline">Ver entregas</Link>
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
