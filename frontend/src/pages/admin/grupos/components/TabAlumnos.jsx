import { useState } from 'react'
import { useGrupoStore } from '../../../../store/grupoStore'

export default function TabAlumnos({ grupo, onAgregarClick }) {
  const { quitarAlumno } = useGrupoStore()
  const [confirmId, setConfirmId] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleQuitar = async (alumnoId) => {
    setLoading(true)
    try {
      await quitarAlumno(grupo.id, alumnoId)
    } finally {
      setLoading(false)
      setConfirmId(null)
    }
  }

  const alumnos = grupo?.alumnos ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">{alumnos.length} alumno(s)</p>
        <button
          onClick={onAgregarClick}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 sm:w-auto"
        >
          + Agregar alumnos
        </button>
      </div>

      {alumnos.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No hay alumnos asignados</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Número de control</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alumnos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{a.numeroControl ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{a.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{a.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {confirmId === a.id ? (
                      <span className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => handleQuitar(a.id)}
                          disabled={loading}
                          className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2"
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(a.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
