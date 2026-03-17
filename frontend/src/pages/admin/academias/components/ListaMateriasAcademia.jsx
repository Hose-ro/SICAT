import { useState } from 'react'
import { useAcademiaStore } from '../../../../store/academiaStore'

export default function ListaMateriasAcademia({ academia, onAgregarClick }) {
  const { quitarMateria } = useAcademiaStore()
  const [error, setError] = useState('')

  const handleQuitar = async (materia) => {
    if (!confirm(`¿Quitar "${materia.nombre}" de esta academia?`)) return
    setError('')
    try {
      await quitarMateria(academia.id, materia.id)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Materias asignadas ({academia.materias?.length ?? 0})
        </h2>
        <button
          onClick={onAgregarClick}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition"
        >
          + Agregar materias
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {academia.materias?.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          No hay materias asignadas a esta academia.
        </p>
      ) : (
        <div className="grid gap-2">
          {academia.materias?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
                <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                  <span>{m.clave}</span>
                  {m.semestre && <span>• Semestre {m.semestre}</span>}
                </div>
              </div>
              <button
                onClick={() => handleQuitar(m)}
                className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
