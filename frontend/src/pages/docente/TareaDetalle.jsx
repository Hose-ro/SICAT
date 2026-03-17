import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTareaStore } from '../../store/tareaStore'

const ESTADO_STYLE = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  REVISADA: 'bg-yellow-100 text-yellow-700',
  CALIFICADA: 'bg-green-100 text-green-700',
  INCORRECTA: 'bg-red-100 text-red-700',
}

export default function TareaDetalle() {
  const { id } = useParams()
  const { tareaActiva, entregas, obtenerDetalle, obtenerEntregas, revisar, calificar, marcarIncorrecta, loading } = useTareaStore()
  const [modal, setModal] = useState(null) // { type, entregaId }
  const [form, setForm] = useState({ observacion: '', calificacion: '' })
  const [noEntregaron, setNoEntregaron] = useState([])

  useEffect(() => {
    obtenerDetalle(Number(id))
    loadEntregas()
  }, [id])

  const loadEntregas = async () => {
    const res = await import('../../api/axios').then(m => m.default.get(`/tareas/${id}/entregas`))
    setNoEntregaron(res.data.noEntregaron || [])
  }

  const handleAccion = async () => {
    if (!modal) return
    try {
      if (modal.type === 'revisar') await revisar(modal.entregaId, form.observacion)
      else if (modal.type === 'calificar') await calificar(modal.entregaId, Number(form.calificacion), form.observacion)
      else if (modal.type === 'incorrecta') await marcarIncorrecta(modal.entregaId, form.observacion)
      setModal(null)
      setForm({ observacion: '', calificacion: '' })
      obtenerEntregas(Number(id))
    } catch (e) { alert('Error') }
  }

  if (!tareaActiva) return <div className="p-6">Cargando...</div>

  return (
    <div className="p-6">
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h1 className="text-xl font-bold">{tareaActiva.titulo}</h1>
        <p className="text-gray-500 text-sm mt-1">{tareaActiva.instrucciones}</p>
        <div className="flex gap-4 mt-3 text-sm text-gray-500">
          <span>Unidad {tareaActiva.unidad}</span>
          <span>Tipo: {tareaActiva.tipoEntrega}</span>
          <span>Límite: {tareaActiva.fechaLimite ? new Date(tareaActiva.fechaLimite).toLocaleDateString('es-MX') : '-'}</span>
          <span>{tareaActiva._count?.entregas ?? 0} entregas</span>
        </div>
      </div>

      <h2 className="font-semibold mb-3">Entregas</h2>
      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2 text-left">Alumno</th>
                <th className="border px-3 py-2">Fecha</th>
                <th className="border px-3 py-2">Estado</th>
                <th className="border px-3 py-2">Calificación</th>
                <th className="border px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entregas.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">
                    <p className="font-medium">{e.alumno?.nombre}</p>
                    <p className="text-xs text-gray-500">{e.alumno?.numeroControl}</p>
                  </td>
                  <td className="border px-3 py-2 text-center text-xs">{new Date(e.fechaEntrega).toLocaleDateString('es-MX')}</td>
                  <td className="border px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_STYLE[e.estadoRevision] || ''}`}>{e.estadoRevision}</span>
                  </td>
                  <td className="border px-3 py-2 text-center">{e.calificacion ?? '-'}</td>
                  <td className="border px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { setModal({ type: 'revisar', entregaId: e.id }); setForm({ observacion: '', calificacion: '' }) }}
                        className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Revisar</button>
                      <button onClick={() => { setModal({ type: 'calificar', entregaId: e.id }); setForm({ observacion: '', calificacion: '' }) }}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Calificar</button>
                      <button onClick={() => { setModal({ type: 'incorrecta', entregaId: e.id }); setForm({ observacion: '', calificacion: '' }) }}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Incorrecta</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {noEntregaron.length > 0 && (
        <div>
          <h3 className="font-semibold text-red-600 mb-2">No han entregado ({noEntregaron.length})</h3>
          <div className="flex flex-wrap gap-2">
            {noEntregaron.map((a) => (
              <span key={a.id} className="px-3 py-1 bg-red-50 border border-red-200 rounded text-xs">{a.nombre}</span>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="font-semibold mb-3 capitalize">{modal.type} entrega</h3>
            {modal.type === 'calificar' && (
              <input type="number" min="0" max="100" placeholder="Calificación (0-100)"
                value={form.calificacion} onChange={(e) => setForm((p) => ({ ...p, calificacion: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm mb-3" />
            )}
            <textarea placeholder="Observación (opcional)" value={form.observacion}
              onChange={(e) => setForm((p) => ({ ...p, observacion: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm mb-3" rows={3} />
            <div className="flex gap-2">
              <button onClick={handleAccion} className="flex-1 py-2 bg-blue-600 text-white rounded text-sm">Confirmar</button>
              <button onClick={() => setModal(null)} className="flex-1 py-2 border rounded text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
