import { useEffect, useState } from 'react'
import { useClaseStore } from '../../../store/claseStore'

export default function TabClaseSesion({ materiaId }) {
  const { sesionActiva, historial, iniciar, finalizar, obtenerActiva, obtenerHistorial, loading } = useClaseStore()
  const [unidad, setUnidad] = useState(1)

  useEffect(() => {
    obtenerActiva(materiaId)
    obtenerHistorial(materiaId)
  }, [materiaId])

  const handleIniciar = async () => {
    try { await iniciar(materiaId, unidad) } catch (e) { alert(e.message) }
  }

  const handleFinalizar = async () => {
    if (!confirm('¿Finalizar la clase? Se registrará FALTA a alumnos sin asistencia.')) return
    try { await finalizar(sesionActiva.id) } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      {sesionActiva ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-800">Clase activa - Unidad {sesionActiva.unidad}</p>
          <p className="text-sm text-green-600">Iniciada: {new Date(sesionActiva.horaInicio).toLocaleTimeString('es-MX')}</p>
          <button onClick={handleFinalizar} disabled={loading}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Finalizar Clase
          </button>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-4 flex items-center gap-3">
          <select value={unidad} onChange={(e) => setUnidad(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm">
            {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
          </select>
          <button onClick={handleIniciar} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Iniciar Clase
          </button>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-2">Historial de clases</h3>
        {historial.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin clases registradas</p>
        ) : (
          <div className="space-y-2">
            {historial.map((s) => (
              <div key={s.id} className="bg-white border rounded p-3 flex justify-between items-center">
                <div>
                  <span className="font-medium text-sm">Unidad {s.unidad}</span>
                  <span className="text-xs text-gray-500 ml-2">{new Date(s.fecha).toLocaleDateString('es-MX')}</span>
                </div>
                <span className="text-xs text-gray-500">{s._count?.asistencias ?? 0} registros</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
