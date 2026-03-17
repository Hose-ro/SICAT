import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTareaStore } from '../../store/tareaStore'

export default function TareaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const materiaId = searchParams.get('materiaId')
  const { crear, loading, error } = useTareaStore()

  const [form, setForm] = useState({
    titulo: '', instrucciones: '', unidad: 1,
    tipoEntrega: 'EN_LINEA', fechaLimite: '',
    materiaId: materiaId ? Number(materiaId) : '',
  })

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await crear({ ...form, materiaId: Number(form.materiaId) })
      navigate(-1)
    } catch {}
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nueva Tarea</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Título</label>
          <input name="titulo" value={form.titulo} onChange={handleChange} required
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Instrucciones</label>
          <textarea name="instrucciones" value={form.instrucciones} onChange={handleChange} required rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Unidad</label>
            <select name="unidad" value={form.unidad} onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {[1,2,3,4,5].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de entrega</label>
            <select name="tipoEntrega" value={form.tipoEntrega} onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="EN_LINEA">En línea</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="FIRMA">Firma</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha límite</label>
          <input type="datetime-local" name="fechaLimite" value={form.fechaLimite} onChange={handleChange} required
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Crear Tarea'}
          </button>
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
