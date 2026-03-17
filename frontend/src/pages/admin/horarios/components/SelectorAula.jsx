import { useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

export default function SelectorAula({ materia, onClose }) {
  const { aulas, asignarAula, quitarAula } = useHorarioStore()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleAsignar(aulaId) {
    setError(null)
    setLoading(true)
    try {
      await asignarAula(materia.id, aulaId)
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleQuitar() {
    setError(null)
    setLoading(true)
    try {
      await quitarAula(materia.id)
      onClose?.()
    } catch {
      setError('Error al quitar aula')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
      )}
      {materia.aula && (
        <div className="flex items-center justify-between text-sm bg-slate-100 rounded p-2">
          <span>Aula actual: <strong>{materia.aula.nombre}</strong></span>
          <button
            onClick={handleQuitar}
            disabled={loading}
            className="text-xs text-red-600 hover:underline"
          >
            Quitar
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500">Seleccionar aula:</p>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {aulas.map((aula) => (
          <button
            key={aula.id}
            onClick={() => handleAsignar(aula.id)}
            disabled={loading || materia.aulaId === aula.id}
            className="w-full text-left text-sm px-3 py-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-medium">{aula.nombre}</span>
            {aula.edificio && <span className="text-slate-400 ml-1">— {aula.edificio}</span>}
            {aula.capacidad && <span className="text-slate-400 ml-1">({aula.capacidad} lugares)</span>}
          </button>
        ))}
        {aulas.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">No hay aulas disponibles</p>
        )}
      </div>
    </div>
  )
}
