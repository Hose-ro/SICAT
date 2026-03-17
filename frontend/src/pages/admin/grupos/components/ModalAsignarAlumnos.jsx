import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'
import Modal from '../../../../components/Modal'

export default function ModalAsignarAlumnos({ open, onClose, grupo }) {
  const { asignarAlumnos } = useGrupoStore()
  const [todosAlumnos, setTodosAlumnos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const idsEnGrupo = new Set(grupo?.alumnos?.map((a) => a.id) ?? [])

  useEffect(() => {
    if (open && grupo) {
      api
        .get('/usuarios', { params: { rol: 'ALUMNO' } })
        .then((res) =>
          setTodosAlumnos(
            res.data.filter((u) => u.rol === 'ALUMNO' && u.activo && u.carreraId === grupo.carreraId)
          )
        )
        .catch(() => {})
      setSeleccionados([])
      setBusqueda('')
      setError('')
    }
  }, [open, grupo])

  const disponibles = todosAlumnos.filter(
    (a) =>
      !idsEnGrupo.has(a.id) &&
      (a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (a.numeroControl ?? '').toLowerCase().includes(busqueda.toLowerCase()))
  )

  const yaEnOtroGrupo = (a) => a.grupoId !== null && a.grupoId !== grupo?.id

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAsignar = async () => {
    if (seleccionados.length === 0) return
    setLoading(true)
    setError('')
    try {
      await asignarAlumnos(grupo.id, seleccionados)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar alumnos al grupo">
      <div className="space-y-3">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o número de control..."
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
          {todosAlumnos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
          )}
          {todosAlumnos.length > 0 && disponibles.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No hay alumnos disponibles para agregar
            </p>
          )}
          {disponibles.map((a) => {
            const bloqueado = yaEnOtroGrupo(a)
            return (
              <label
                key={a.id}
                title={bloqueado ? 'Ya está en otro grupo' : undefined}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg ${
                  bloqueado ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={bloqueado}
                  checked={seleccionados.includes(a.id)}
                  onChange={() => toggleSeleccion(a.id)}
                  className="accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {a.numeroControl && <span>{a.numeroControl} · </span>}
                    {bloqueado ? (
                      <span className="text-amber-500">Ya en otro grupo</span>
                    ) : (
                      a.email
                    )}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleAsignar}
          disabled={seleccionados.length === 0 || loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading
            ? 'Asignando...'
            : `Asignar${seleccionados.length > 0 ? ` (${seleccionados.length})` : ''}`}
        </button>
      </div>
    </Modal>
  )
}
