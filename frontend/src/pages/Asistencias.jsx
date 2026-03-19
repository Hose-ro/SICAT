import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function Asistencias() {
  const [docentes, setDocentes] = useState([])
  const [materias, setMaterias] = useState([])
  const [resumen, setResumen] = useState([])
  const [docenteId, setDocenteId] = useState('')
  const [materiaId, setMateriaId] = useState('')
  const [unidad, setUnidad] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/usuarios?rol=DOCENTE').then((r) => setDocentes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!docenteId) { setMaterias([]); setMateriaId(''); return }
    api.get(`/materias?docenteId=${docenteId}`).then((r) => setMaterias(r.data)).catch(() => {})
    setMateriaId('')
    setResumen([])
  }, [docenteId])

  useEffect(() => {
    if (!materiaId) { setResumen([]); return }
    setLoading(true)
    const q = unidad ? `?unidad=${unidad}` : ''
    api.get(`/asistencias/materia/${materiaId}${q}`)
      .then((r) => setResumen(r.data))
      .catch(() => setResumen([]))
      .finally(() => setLoading(false))
  }, [materiaId, unidad])

  const exportar = async (formato) => {
    if (!materiaId) return
    const params = new URLSearchParams({ formato })
    if (unidad) params.append('unidad', unidad)
    const res = await api.get(`/asistencias/exportar/${materiaId}?${params}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencias.${formato === 'pdf' ? 'pdf' : 'xlsx'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const top5Faltas = [...resumen].sort((a, b) => b.faltas - a.faltas).slice(0, 5)

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-bold sm:text-2xl">Asistencias</h1>

      {/* Filtros */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-3">Filtrar por docente y materia</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <select value={docenteId} onChange={(e) => setDocenteId(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm sm:w-auto">
            <option value="">Seleccionar docente...</option>
            {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}
            disabled={!docenteId}
            className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50 sm:w-auto">
            <option value="">Seleccionar materia...</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
            disabled={!materiaId}
            className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50 sm:w-auto">
            <option value="">Todas las unidades</option>
            {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
          </select>
          {materiaId && (
            <>
              <button onClick={() => exportar('excel')}
                className="w-full rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 sm:w-auto">
                Excel
              </button>
              <button onClick={() => exportar('pdf')}
                className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 sm:w-auto">
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : resumen.length > 0 ? (
        <div className="space-y-6">
          {/* Top 5 faltas */}
          {top5Faltas.some((a) => a.faltas > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-700 mb-2">Top 5 alumnos con más faltas</h3>
              <div className="flex flex-wrap gap-2">
                {top5Faltas.filter((a) => a.faltas > 0).map((a) => (
                  <span key={a.alumnoId} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    {a.nombre}: {a.faltas} faltas
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabla de resumen */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-3 py-2 text-left">Alumno</th>
                  <th className="border px-3 py-2">Num. Control</th>
                  <th className="border px-3 py-2 text-green-700">Asistencias</th>
                  <th className="border px-3 py-2 text-red-700">Faltas</th>
                  <th className="border px-3 py-2 text-yellow-700">Retardos</th>
                  <th className="border px-3 py-2 text-blue-700">Justificadas</th>
                  <th className="border px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={r.alumnoId} className="hover:bg-gray-50">
                    <td className="border px-3 py-2 font-medium">{r.nombre}</td>
                    <td className="border px-3 py-2 text-center text-gray-500">{r.numControl || '-'}</td>
                    <td className="border px-3 py-2 text-center text-green-700 font-semibold">{r.asistencias}</td>
                    <td className="border px-3 py-2 text-center text-red-700 font-semibold">{r.faltas}</td>
                    <td className="border px-3 py-2 text-center text-yellow-700 font-semibold">{r.retardos}</td>
                    <td className="border px-3 py-2 text-center text-blue-700 font-semibold">{r.justificadas}</td>
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
        </div>
      ) : materiaId ? (
        <p className="text-gray-400 text-center py-8">No hay datos de asistencia para esta materia</p>
      ) : (
        <p className="text-gray-400 text-center py-8">Selecciona un docente y materia para ver los reportes</p>
      )}
    </div>
  )
}
