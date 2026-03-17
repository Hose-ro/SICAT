import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAcademiaStore } from '../../../store/academiaStore'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'

export default function AcademiasPage() {
  const navigate = useNavigate()
  const { academias, loading, error, cargarAcademias, crearAcademia, eliminarAcademia, clearError } =
    useAcademiaStore()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => { cargarAcademias() }, [cargarAcademias])

  const handleCrear = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      await crearAcademia(form)
      setModal(false)
      setForm({ nombre: '', descripcion: '' })
    } catch (err) {
      setFormError(err.message)
    }
  }

  const handleEliminar = async (id, nombre) => {
    if (!confirm(`¿Desactivar la academia "${nombre}"?`)) return
    await eliminarAcademia(id)
  }

  return (
    <>
      <PageHeader
        title="Academias"
        subtitle="Grupos de docentes por área de conocimiento"
        action={
          <button
            onClick={() => { setModal(true); setFormError(''); setForm({ nombre: '', descripcion: '' }) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nueva academia
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between mb-4">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {loading && academias.length === 0 ? (
        <p className="text-sm text-gray-400">Cargando academias...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {academias.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏛️</span>
                  <div>
                    <p className="font-semibold text-gray-800">{a.nombre}</p>
                    {a.descripcion && (
                      <p className="text-xs text-gray-400 mt-0.5">{a.descripcion}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <i className="ri-user-3-line" />
                  {a._count.docentes} docente{a._count.docentes !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-book-2-line" />
                  {a._count.materias} materia{a._count.materias !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-50">
                <button
                  onClick={() => navigate(`/admin/academias/${a.id}`)}
                  className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-1.5 rounded-lg transition"
                >
                  Ver detalle
                </button>
                <button
                  onClick={() => handleEliminar(a.id, a.nombre)}
                  className="text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                >
                  Desactivar
                </button>
              </div>
            </div>
          ))}

          {academias.length === 0 && !loading && (
            <p className="text-sm text-gray-400 col-span-full text-center py-8">
              No hay academias registradas. Crea la primera.
            </p>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva academia">
        <form onSubmit={handleCrear} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              required
              minLength={3}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Ciencias Básicas"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Matemáticas, física y química"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear academia'}
          </button>
        </form>
      </Modal>
    </>
  )
}
