import { useState } from 'react'
import { useTareaStore } from '../../../store/tareaStore'

export default function FormEntregaTarea({ tarea, onSuccess }) {
  const { entregar, loading } = useTareaStore()
  const [archivo, setArchivo] = useState(null)
  const [firma, setFirma] = useState(null)
  const [comentario, setComentario] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await entregar(tarea.id, archivo, firma, comentario)
      onSuccess?.()
    } catch (e) {
      alert(e.response?.data?.message || 'Error al entregar')
    }
  }

  if (tarea.tipoEntrega === 'PRESENCIAL') {
    return (
      <div className="bg-gray-50 border rounded-lg p-4 text-center text-gray-600">
        Esta tarea se entrega de forma presencial en clase.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {tarea.tipoEntrega === 'EN_LINEA' && (
        <div>
          <label className="block text-sm font-medium mb-1">Archivo</label>
          <input type="file" onChange={(e) => setArchivo(e.target.files[0])}
            className="text-sm" />
        </div>
      )}
      {tarea.tipoEntrega === 'FIRMA' && (
        <div>
          <label className="block text-sm font-medium mb-1">Foto de firma</label>
          <input type="file" accept="image/*" onChange={(e) => setFirma(e.target.files[0])}
            className="text-sm" />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Comentario (opcional)</label>
        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
          rows={2} className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Enviando...' : 'Entregar'}
      </button>
    </form>
  )
}
