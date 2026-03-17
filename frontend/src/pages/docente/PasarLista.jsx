import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAsistenciaStore } from '../../store/asistenciaStore'
import { useInscripcionStore } from '../../store/inscripcionStore'
import api from '../../api/axios'

const ESTADOS = ['ASISTENCIA', 'FALTA', 'RETARDO']
const ESTADO_STYLE = {
  ASISTENCIA: 'bg-green-600 text-white',
  FALTA: 'bg-red-600 text-white',
  RETARDO: 'bg-yellow-500 text-white',
  '': 'bg-gray-100 text-gray-600'
}

export default function PasarLista() {
  const { sesionId } = useParams()
  const navigate = useNavigate()
  const { pasarLista, loading } = useAsistenciaStore()
  const [listaAlumnos, setListaAlumnos] = useState([])
  const [registros, setRegistros] = useState({})
  const [sesion, setSesion] = useState(null)

  useEffect(() => {
    api.get(`/asistencias/sesion/${sesionId}`).then((res) => {
      setListaAlumnos(res.data)
      const init = {}
      res.data.forEach((a) => { init[a.alumnoId] = a.estado })
      setRegistros(init)
    })
    api.get(`/clases/historial/0`).catch(() => {})
  }, [sesionId])

  const setEstado = (alumnoId, estado) => {
    setRegistros((prev) => ({ ...prev, [alumnoId]: estado }))
  }

  const handleGuardar = async () => {
    const registrosArr = listaAlumnos.map((a) => ({
      alumnoId: a.alumnoId,
      estado: registros[a.alumnoId] || 'FALTA',
    }))
    try {
      const result = await pasarLista(Number(sesionId), registrosArr)
      alert(`Lista guardada: ${result.asistencias}A, ${result.faltas}F, ${result.retardos}R`)
      navigate(-1)
    } catch (e) {
      alert('Error al guardar')
    }
  }

  const conteos = { ASISTENCIA: 0, FALTA: 0, RETARDO: 0 }
  Object.values(registros).forEach((e) => { if (conteos[e] !== undefined) conteos[e]++ })

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Pasar Lista</h1>
      <p className="text-gray-500 text-sm mb-4">Sesión #{sesionId}</p>

      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-700 font-semibold">A: {conteos.ASISTENCIA}</span>
        <span className="text-red-700 font-semibold">F: {conteos.FALTA}</span>
        <span className="text-yellow-700 font-semibold">R: {conteos.RETARDO}</span>
      </div>

      <div className="space-y-2 mb-6">
        {listaAlumnos.map((a) => (
          <div key={a.alumnoId} className="bg-white border rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">{a.alumno?.nombre}</p>
              <p className="text-xs text-gray-500">{a.alumno?.numeroControl}</p>
            </div>
            <div className="flex gap-1">
              {ESTADOS.map((e) => (
                <button key={e}
                  onClick={() => setEstado(a.alumnoId, e)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    registros[a.alumnoId] === e ? ESTADO_STYLE[e] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {e.charAt(0)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleGuardar} disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Guardando...' : 'Guardar Lista'}
      </button>
    </div>
  )
}
