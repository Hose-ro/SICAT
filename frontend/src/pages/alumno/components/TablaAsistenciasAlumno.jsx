import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'

const ESTADO_STYLE = {
  ASISTENCIA: 'bg-green-100 text-green-800',
  FALTA: 'bg-red-100 text-red-800',
  RETARDO: 'bg-yellow-100 text-yellow-800',
  JUSTIFICADA: 'bg-blue-100 text-blue-800',
}

export default function TablaAsistenciasAlumno({ materiaId }) {
  const { misAsistencias, obtenerMisAsistencias, justificar, loading } = useAsistenciaStore()
  const [unidad, setUnidad] = useState('')
  const [justModal, setJustModal] = useState(null)
  const [justText, setJustText] = useState('')

  useEffect(() => { obtenerMisAsistencias(materiaId) }, [materiaId])

  const filtradas = unidad ? misAsistencias.filter((a) => a.unidad === Number(unidad)) : misAsistencias
  const totales = filtradas.reduce((acc, a) => {
    if (a.estado) acc[a.estado] = (acc[a.estado] || 0) + 1
    return acc
  }, {})

  const handleJustificar = async () => {
    try {
      await justificar(justModal, justText)
      setJustModal(null)
      setJustText('')
      obtenerMisAsistencias(materiaId)
    } catch { alert('Error al justificar') }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm flex-wrap">
        {Object.entries(totales).map(([e, c]) => (
          <span key={e} className={`px-3 py-1 rounded-full font-medium ${ESTADO_STYLE[e]}`}>{e}: {c}</span>
        ))}
        <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
          className="border rounded px-3 py-1 text-sm ml-auto">
          <option value="">Todas las unidades</option>
          {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left">Fecha</th>
              <th className="border px-3 py-2">Unidad</th>
              <th className="border px-3 py-2">Estado</th>
              <th className="border px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((a, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{a.fecha ? new Date(a.fecha).toLocaleDateString('es-MX') : '-'}</td>
                <td className="border px-3 py-2 text-center">{a.unidad}</td>
                <td className="border px-3 py-2 text-center">
                  {a.estado ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_STYLE[a.estado]}`}>{a.estado}</span>
                  ) : <span className="text-gray-400 text-xs">Sin registro</span>}
                </td>
                <td className="border px-3 py-2 text-center">
                  {a.estado === 'FALTA' && (
                    <button onClick={() => setJustModal(a.id)}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                      Justificar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {justModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="font-semibold mb-3">Justificar falta</h3>
            <textarea value={justText} onChange={(e) => setJustText(e.target.value)}
              placeholder="Motivo de la justificación..." rows={3}
              className="w-full border rounded px-3 py-2 text-sm mb-3" />
            <div className="flex gap-2">
              <button onClick={handleJustificar} className="flex-1 py-2 bg-blue-600 text-white rounded text-sm">Enviar</button>
              <button onClick={() => setJustModal(null)} className="flex-1 py-2 border rounded text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
