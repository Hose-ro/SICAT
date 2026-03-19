import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/axios'
import FormEntregaTarea from './components/FormEntregaTarea'
import { useAuthStore } from '../../store/authStore'

const ESTADO_STYLE = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  REVISADA: 'bg-yellow-100 text-yellow-700',
  CALIFICADA: 'bg-green-100 text-green-700',
  INCORRECTA: 'bg-red-100 text-red-700',
}

export default function TareaDetalleAlumno() {
  const { id } = useParams()
  const [tarea, setTarea] = useState(null)
  const [miEntrega, setMiEntrega] = useState(null)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    api.get(`/tareas/${id}`).then((r) => setTarea(r.data))
    if (user?.id) {
      api.get(`/tareas/mis-tareas/${id}`).catch(() => {})
    }
  }, [id])

  const handleSuccess = () => {
    api.get(`/tareas/${id}`).then((r) => setTarea(r.data))
  }

  if (!tarea) return <div className="px-4 py-4 sm:px-6 sm:py-6">Cargando...</div>

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h1 className="text-xl font-bold">{tarea.titulo}</h1>
        <p className="text-gray-600 mt-2 text-sm">{tarea.instrucciones}</p>
        <div className="flex gap-4 mt-3 text-sm text-gray-500 flex-wrap">
          <span>Unidad {tarea.unidad}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            tarea.tipoEntrega === 'EN_LINEA' ? 'bg-blue-100 text-blue-700' :
            tarea.tipoEntrega === 'FIRMA' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
          }`}>{tarea.tipoEntrega}</span>
          <span>Límite: {tarea.fechaLimite ? new Date(tarea.fechaLimite).toLocaleDateString('es-MX') : '-'}</span>
        </div>
      </div>

      {miEntrega ? (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Mi entrega</h2>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${ESTADO_STYLE[miEntrega.estadoRevision]}`}>
              {miEntrega.estadoRevision}
            </span>
            {miEntrega.calificacion != null && (
              <span className="text-lg font-bold text-green-700">{miEntrega.calificacion}/100</span>
            )}
          </div>
          {miEntrega.observacion && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{miEntrega.observacion}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Entregado: {new Date(miEntrega.fechaEntrega).toLocaleDateString('es-MX')}
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Entregar tarea</h2>
          <FormEntregaTarea tarea={tarea} onSuccess={handleSuccess} />
        </div>
      )}
    </div>
  )
}
