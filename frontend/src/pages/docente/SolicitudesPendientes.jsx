import { useEffect, useState } from 'react'
import { useInscripcionStore } from '../../store/inscripcionStore'

export default function SolicitudesPendientes() {
  const { pendientesDocente, obtenerPendientes, aceptar, rechazar, loading } = useInscripcionStore()
  const [procesando, setProcesando] = useState(null)

  useEffect(() => { obtenerPendientes() }, [])

  const handleAceptar = async (id) => {
    setProcesando(id)
    try { await aceptar(id) } finally { setProcesando(null) }
  }

  const handleRechazar = async (id) => {
    setProcesando(id)
    try { await rechazar(id) } finally { setProcesando(null) }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Solicitudes Pendientes</h1>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : pendientesDocente.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No hay solicitudes pendientes
        </div>
      ) : (
        <div className="space-y-3">
          {pendientesDocente.map((s) => (
            <div key={s.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{s.alumno?.nombre}</p>
                <p className="text-sm text-gray-500">
                  {s.materia?.nombre} · Periodo: {s.periodo}
                </p>
                <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString('es-MX')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAceptar(s.id)}
                  disabled={procesando === s.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => handleRechazar(s.id)}
                  disabled={procesando === s.id}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
