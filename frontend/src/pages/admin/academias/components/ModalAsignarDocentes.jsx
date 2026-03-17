import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useAcademiaStore } from '../../../../store/academiaStore'
import Modal from '../../../../components/Modal'

export default function ModalAsignarDocentes({ open, onClose, academia }) {
  const { asignarDocentes } = useAcademiaStore()
  const [todosDocentes, setTodosDocentes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const idsAsignados = new Set(academia.docentes?.map((d) => d.id) ?? [])

  useEffect(() => {
    if (open) {
      api
        .get('/usuarios')
        .then((res) => setTodosDocentes(res.data.filter((u) => u.rol === 'DOCENTE' && u.activo)))
      setSeleccionados([])
      setBusqueda('')
      setError('')
    }
  }, [open])

  const disponibles = todosDocentes.filter(
    (d) =>
      !idsAsignados.has(d.id) &&
      d.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleAsignar = async () => {
    if (seleccionados.length === 0) return
    setLoading(true)
    setError('')
    try {
      await asignarDocentes(academia.id, seleccionados)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar docentes a la academia">
      <div className="space-y-3">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar docente por nombre..."
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
          {disponibles.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {todosDocentes.length === 0
                ? 'Cargando...'
                : 'No hay docentes disponibles para agregar'}
            </p>
          )}
          {disponibles.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={seleccionados.includes(d.id)}
                onChange={() => toggleSeleccion(d.id)}
                className="accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{d.nombre}</p>
                {d.email && <p className="text-xs text-gray-400">{d.email}</p>}
              </div>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleAsignar}
          disabled={seleccionados.length === 0 || loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading
            ? 'Asignando...'
            : `Asignar ${seleccionados.length > 0 ? `(${seleccionados.length})` : 'seleccionados'}`}
        </button>
      </div>
    </Modal>
  )
}
