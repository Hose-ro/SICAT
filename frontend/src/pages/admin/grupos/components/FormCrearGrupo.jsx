import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'
import Modal from '../../../../components/Modal'

const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const SECCIONES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function FormCrearGrupo({ open, onClose }) {
  const navigate = useNavigate()
  const { crearGrupo } = useGrupoStore()
  const [carreras, setCarreras] = useState([])
  const [grupos, setGrupos] = useState([])
  const [form, setForm] = useState({ carreraId: '', semestre: '', seccion: '', periodo: '2026-A' })
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'confirm'

  useEffect(() => {
    if (open) {
      setForm({ carreraId: '', semestre: '', seccion: '', periodo: '2026-A' })
      setPreview(null)
      setError('')
      setStep('form')
      api.get('/carreras').then((res) => setCarreras(res.data)).catch(() => {})
      api.get('/grupos').then((res) => setGrupos(res.data)).catch(() => {})
    }
  }, [open])

  // Sugerir siguiente sección disponible
  const seccionSugerida = () => {
    if (!form.carreraId || !form.semestre || !form.periodo) return 'A'
    const carrera = carreras.find((c) => c.id === Number(form.carreraId))
    if (!carrera) return 'A'
    for (const letra of SECCIONES) {
      const nombre = `${form.semestre}${carrera.codigo}${letra}`
      const existe = grupos.some((g) => g.nombre === nombre && g.periodo === form.periodo)
      if (!existe) return letra
    }
    return 'A'
  }

  const handlePreview = async (e) => {
    e.preventDefault()
    setError('')
    const carrera = carreras.find((c) => c.id === Number(form.carreraId))
    if (!carrera) { setError('Selecciona una carrera'); return }
    const nombre = `${form.semestre}${carrera.codigo}${form.seccion}`
    // Obtener materias directamente de la retícula (no de Materia operativa)
    try {
      const res = await api.get('/reticula', {
        params: { carreraId: form.carreraId, semestre: form.semestre },
      })
      const materias = Array.isArray(res.data) ? res.data : []
      setPreview({ nombre, carrera, materias, ...form })
      setStep('confirm')
    } catch {
      setPreview({ nombre, carrera, materias: [], ...form })
      setStep('confirm')
    }
  }

  const handleConfirmar = async () => {
    setLoading(true)
    setError('')
    try {
      const grupo = await crearGrupo({
        semestre: Number(form.semestre),
        seccion: form.seccion,
        carreraId: Number(form.carreraId),
        periodo: form.periodo,
      })
      onClose()
      navigate(`/admin/grupos/${grupo.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSugerirSeccion = () => {
    setForm((f) => ({ ...f, seccion: seccionSugerida() }))
  }

  return (
    <Modal open={open} onClose={onClose} title="Crear grupo">
      {step === 'form' ? (
        <form onSubmit={handlePreview} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Carrera *</label>
            <select
              required
              value={form.carreraId}
              onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar carrera...</option>
              {carreras.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semestre *</label>
            <select
              required
              value={form.semestre}
              onChange={(e) => setForm({ ...form, semestre: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar semestre...</option>
              {SEMESTRES.map((s) => (
                <option key={s} value={s}>Semestre {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sección *</label>
            <div className="flex gap-2">
              <input
                required
                maxLength={1}
                pattern="[A-Z]"
                placeholder="A"
                value={form.seccion}
                onChange={(e) => setForm({ ...form, seccion: e.target.value.toUpperCase() })}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSugerirSeccion}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-xl px-3 py-2"
              >
                Sugerir
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Una letra mayúscula (A-Z)</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Periodo *</label>
            <input
              required
              placeholder="2026-A"
              value={form.periodo}
              onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Continuar
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Resumen del grupo a crear</p>
            <p className="text-3xl font-bold text-blue-700">{preview?.nombre}</p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Carrera:</span> {preview?.carrera?.nombre}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Semestre:</span> {preview?.semestre}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Periodo:</span> {preview?.periodo}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Materias de retícula:</span>{' '}
              {preview?.materias?.length > 0
                ? `Se asignarán automáticamente ${preview.materias.length} materias`
                : 'No se encontraron materias en la retícula para este semestre/carrera'}
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setStep('form')}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition"
            >
              Atrás
            </button>
            <button
              onClick={handleConfirmar}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
