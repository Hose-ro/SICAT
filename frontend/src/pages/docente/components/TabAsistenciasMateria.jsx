import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'

const estadoColor = { ASISTENCIA: 'bg-green-100 text-green-800', FALTA: 'bg-red-100 text-red-800', RETARDO: 'bg-yellow-100 text-yellow-800', JUSTIFICADA: 'bg-blue-100 text-blue-800' }
const estadoLetra = { ASISTENCIA: 'A', FALTA: 'F', RETARDO: 'R', JUSTIFICADA: 'J' }

export default function TabAsistenciasMateria({ materiaId }) {
  const { resumen, obtenerResumen, exportar, loading } = useAsistenciaStore()
  const [unidad, setUnidad] = useState('')

  useEffect(() => { obtenerResumen(materiaId, unidad || undefined) }, [materiaId, unidad])

  const handleExportar = (formato) => exportar(materiaId, formato, unidad || undefined)

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">Todas las unidades</option>
          {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
        </select>
        <button onClick={() => handleExportar('excel')}
          className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
          Exportar Excel
        </button>
        <button onClick={() => handleExportar('pdf')}
          className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
          Exportar PDF
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : resumen.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin datos de asistencia</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2 text-left">Alumno</th>
                <th className="border px-3 py-2">Asistencias</th>
                <th className="border px-3 py-2">Faltas</th>
                <th className="border px-3 py-2">Retardos</th>
                <th className="border px-3 py-2">Justificadas</th>
                <th className="border px-3 py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.alumnoId} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">
                    <p className="font-medium">{r.nombre}</p>
                    <p className="text-xs text-gray-500">{r.numControl}</p>
                  </td>
                  <td className="border px-3 py-2 text-center text-green-700">{r.asistencias}</td>
                  <td className="border px-3 py-2 text-center text-red-700">{r.faltas}</td>
                  <td className="border px-3 py-2 text-center text-yellow-700">{r.retardos}</td>
                  <td className="border px-3 py-2 text-center text-blue-700">{r.justificadas}</td>
                  <td className="border px-3 py-2 text-center">
                    <span className={`font-semibold ${r.porcentaje >= 70 ? 'text-green-700' : 'text-red-700'}`}>
                      {r.porcentaje}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
