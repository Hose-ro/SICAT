import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'
import Modal from '../../../../components/Modal'

function hayConflictoHorario(a, b) {
  const diasA = a.dias.split(',').map((d) => d.trim().toLowerCase())
  const diasB = b.dias.split(',').map((d) => d.trim().toLowerCase())
  const comunes = diasA.filter((d) => diasB.includes(d))
  if (comunes.length === 0) return false
  const aMin = (h) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm }
  const iA = aMin(a.horaInicio), fA = aMin(a.horaFin)
  const iB = aMin(b.horaInicio), fB = aMin(b.horaFin)
  return iA < fB && iB < fA
}

const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function ModalAgregarMaterias({ open, onClose, grupo }) {
  const { agregarMaterias } = useGrupoStore()
  const [todasMaterias, setTodasMaterias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroSemestre, setFiltroSemestre] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const idsEnGrupo = new Set(grupo?.materias?.map((m) => m.id) ?? [])

  useEffect(() => {
    if (open && grupo) {
      api
        .get('/materias', { params: { carreraId: grupo.carreraId } })
        .then((res) =>
          setTodasMaterias(res.data.filter((m) => m.carreraId === grupo.carreraId))
        )
        .catch(() => {})
      setSeleccionados([])
      setBusqueda('')
      setFiltroSemestre('')
      setError('')
    }
  }, [open, grupo])

  const disponibles = todasMaterias.filter((m) => {
    if (idsEnGrupo.has(m.id)) return false
    if (filtroSemestre && m.semestre !== Number(filtroSemestre)) return false
    const q = busqueda.toLowerCase()
    return m.nombre.toLowerCase().includes(q) || m.clave.toLowerCase().includes(q)
  })

  const tieneConflicto = (materia) => {
    const materiasGrupo = grupo?.materias ?? []
    return materiasGrupo.some((mg) => hayConflictoHorario(materia, mg))
  }

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAgregar = async () => {
    if (seleccionados.length === 0) return
    setLoading(true)
    setError('')
    try {
      await agregarMaterias(grupo.id, seleccionados)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar materias al grupo">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o clave..."
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filtroSemestre}
            onChange={(e) => setFiltroSemestre(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {SEMESTRES.map((s) => (
              <option key={s} value={s}>Sem {s}</option>
            ))}
          </select>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
          {todasMaterias.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
          )}
          {todasMaterias.length > 0 && disponibles.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No hay materias disponibles</p>
          )}
          {disponibles.map((m) => {
            const conflicto = tieneConflicto(m)
            return (
              <label
                key={m.id}
                className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(m.id)}
                  onChange={() => toggleSeleccion(m.id)}
                  className="accent-blue-600 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.nombre}</p>
                    {conflicto && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                        Conflicto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {m.clave} · Sem {m.semestre} · {m.dias} {m.horaInicio}-{m.horaFin}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleAgregar}
          disabled={seleccionados.length === 0 || loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading
            ? 'Agregando...'
            : `Agregar${seleccionados.length > 0 ? ` (${seleccionados.length})` : ''}`}
        </button>
      </div>
    </Modal>
  )
}
