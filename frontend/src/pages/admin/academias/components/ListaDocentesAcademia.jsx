import { useState } from 'react'
import { useAcademiaStore } from '../../../../store/academiaStore'

export default function ListaDocentesAcademia({ academia, onAgregarClick }) {
  const { quitarDocente } = useAcademiaStore()
  const [error, setError] = useState('')

  const handleQuitar = async (docente) => {
    if (!confirm(`¿Quitar a "${docente.nombre}" de esta academia?`)) return
    setError('')
    try {
      await quitarDocente(academia.id, docente.id)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Docentes asignados ({academia.docentes?.length ?? 0})
        </h2>
        <button
          onClick={onAgregarClick}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition"
        >
          + Agregar docentes
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {academia.docentes?.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          No hay docentes asignados a esta academia.
        </p>
      ) : (
        <div className="grid gap-2">
          {academia.docentes?.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                  {d.nombre[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.nombre}</p>
                  {d.email && <p className="text-xs text-gray-400">{d.email}</p>}
                </div>
              </div>
              <button
                onClick={() => handleQuitar(d)}
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
