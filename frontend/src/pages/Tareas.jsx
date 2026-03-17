import { useEffect, useState } from 'react'
import api from '../api/axios'
import { Link } from 'react-router-dom'

export default function Tareas() {
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
    api.get(`/tareas/reporte/${materiaId}${q}`)
      .then((r) => setResumen(r.data))
      .catch(() => setResumen([]))
      .finally(() => setLoading(false))
  }, [materiaId, unidad])

  const pendientesRevision = resumen.reduce((sum, t) => {
    const p = t.entregadas - t.calificadas
    return sum + (p > 0 ? p : 0)
  }, 0)

  const tareasSemana = resumen.filter((t) => {
    if (!t.tarea?.fechaPublicacion) return false
    const diff = Date.now() - new Date(t.tarea.fechaPublicacion).getTime()
    return diff < 7 * 24 * 60 * 60 * 1000
  }).length

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tareas</h1>

      {/* Filtros */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Filtrar</h2>
        <div className="flex gap-3 flex-wrap">
          <select value={docenteId} onChange={(e) => setDocenteId(e.target.value)}
            className="border rounded px-3 py-2 text-sm">
            <option value="">Seleccionar docente...</option>
            {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}
            disabled={!docenteId}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50">
            <option value="">Seleccionar materia...</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
            disabled={!materiaId}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50">
            <option value="">Todas las unidades</option>
            {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      {materiaId && resumen.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{resumen.length}</p>
            <p className="text-xs text-blue-600">Tareas totales</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{tareasSemana}</p>
            <p className="text-xs text-green-600">Esta semana</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{pendientesRevision}</p>
            <p className="text-xs text-yellow-600">Pendientes revisión</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-700">
              {resumen.reduce((s, t) => s + t.entregadas, 0)}
            </p>
            <p className="text-xs text-purple-600">Entregas totales</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : resumen.length > 0 ? (
        <div className="space-y-3">
          {resumen.map(({ tarea, entregadas, calificadas, promedio }) => (
            <div key={tarea.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{tarea.titulo}</p>
                  <p className="text-sm text-gray-500">
                    Unidad {tarea.unidad} · {tarea.tipoEntrega} ·
                    Límite: {tarea.fechaLimite ? new Date(tarea.fechaLimite).toLocaleDateString('es-MX') : '-'}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-600">{entregadas} entregas</p>
                  <p className="text-gray-500">{calificadas} calificadas</p>
                  {promedio != null && (
                    <p className="text-green-700 font-semibold">Prom: {promedio.toFixed(1)}</p>
                  )}
                </div>
              </div>
              {entregadas - calificadas > 0 && (
                <p className="text-xs text-yellow-600 mt-2 bg-yellow-50 rounded px-2 py-1 inline-block">
                  {entregadas - calificadas} pendientes de calificación
                </p>
              )}
            </div>
          ))}
        </div>
      ) : materiaId ? (
        <p className="text-gray-400 text-center py-8">No hay tareas para esta materia</p>
      ) : (
        <p className="text-gray-400 text-center py-8">Selecciona un docente y materia para ver las tareas</p>
      )}
    </div>
  )
}
