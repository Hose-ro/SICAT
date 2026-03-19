import { useEffect, useState } from 'react'
import { useInscripcionStore } from '../../store/inscripcionStore'
import api from '../../api/axios'

const ESTADO_STYLE = {
  PENDIENTE: 'bg-yellow-100 text-yellow-700',
  ACEPTADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
}

export default function InscripcionesAlumno() {
  const { misSolicitudes, obtenerMisSolicitudes, solicitar, loading } = useInscripcionStore()
  const [materias, setMaterias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [periodo, setPeriodo] = useState('2026-A')
  const [solicitando, setSolicitando] = useState(null)

  useEffect(() => { obtenerMisSolicitudes() }, [])

  useEffect(() => {
    if (busqueda.length > 1) {
      api.get(`/materias?search=${busqueda}`).then((r) => setMaterias(r.data)).catch(() => {})
    }
  }, [busqueda])

  const handleSolicitar = async (materiaId) => {
    setSolicitando(materiaId)
    try {
      await solicitar(materiaId, periodo)
      obtenerMisSolicitudes()
      alert('Solicitud enviada')
    } catch (e) {
      alert(e.response?.data?.message || 'Error')
    } finally {
      setSolicitando(null)
    }
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">Inscripciones</h1>

      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Solicitar inscripción</h2>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar materia..."
            className="flex-1 border rounded px-3 py-2 text-sm" />
          <input value={periodo} onChange={(e) => setPeriodo(e.target.value)}
            placeholder="Periodo (ej. 2026-A)"
            className="w-full border rounded px-3 py-2 text-sm sm:w-36" />
        </div>
        {materias.length > 0 && (
          <div className="space-y-2">
            {materias.map((m) => (
              <div key={m.id} className="flex flex-col gap-3 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-medium">{m.nombre}</span>
                  <span className="text-gray-500 ml-2">({m.clave})</span>
                  <span className="text-xs text-gray-400 ml-2">{m.docente?.nombre}</span>
                </div>
                <button onClick={() => handleSolicitar(m.id)} disabled={solicitando === m.id}
                  className="w-full rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto">
                  Solicitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="font-semibold mb-3">Mis solicitudes</h2>
      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : misSolicitudes.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin solicitudes</p>
      ) : (
        <div className="space-y-2">
          {misSolicitudes.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">{s.materia?.nombre}</p>
                <p className="text-xs text-gray-500">
                  {s.materia?.docente?.nombre} · Periodo: {s.periodo}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[s.estado]}`}>
                {s.estado}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
