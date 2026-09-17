import { Button } from '@/components/ui/button'
import { useId, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'
import Modal from '../../../../components/Modal'
import { getCurrentAcademicPeriod } from '../../../../lib/periodo'

const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function FormCrearGrupo({ open, onClose }) {
  const fieldId = useId()
  const navigate = useNavigate()
  const { crearGrupo } = useGrupoStore()
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState({ nombre: '', carreraId: '', semestre: '', periodo: getCurrentAcademicPeriod() })
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'confirm'

  useEffect(() => {
    if (open) {
      setForm({ nombre: '', carreraId: '', semestre: '', periodo: getCurrentAcademicPeriod() })
      setPreview(null)
      setError('')
      setStep('form')
      api.get('/carreras').then((res) => setCarreras(res.data)).catch(() => {})
    }
  }, [open])

  const handlePreview = async (e) => {
    e.preventDefault()
    setError('')
    const carrera = carreras.find((c) => c.id === Number(form.carreraId))
    if (!carrera) { setError('Selecciona una carrera'); return }
    const nombre = form.nombre.trim().replace(/\s+/g, ' ').toUpperCase()
    if (!nombre) { setError('Escribe el nombre del grupo'); return }
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
        nombre: preview.nombre,
        semestre: Number(form.semestre),
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

  return (
    <Modal open={open} onClose={onClose} title="Crear grupo">
      {step === 'form' ? (
        <form onSubmit={handlePreview} className="space-y-4">
          <div>
            <label htmlFor={fieldId + '-control-76'} className="block text-xs font-medium text-foreground mb-1">Nombre del grupo *</label>
            <input id={fieldId + '-control-76'}
              required
              maxLength={20}
              placeholder="103A"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">Como lo nombra la institución, por ejemplo 103A</p>
          </div>

          <div>
            <label htmlFor={fieldId + '-control-89'} className="block text-xs font-medium text-foreground mb-1">Carrera *</label>
            <select id={fieldId + '-control-89'}
              required
              value={form.carreraId}
              onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar carrera...</option>
              {carreras.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={fieldId + '-control-104'} className="block text-xs font-medium text-foreground mb-1">Semestre *</label>
            <select id={fieldId + '-control-104'}
              required
              value={form.semestre}
              onChange={(e) => setForm({ ...form, semestre: e.target.value })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar semestre...</option>
              {SEMESTRES.map((s) => (
                <option key={s} value={s}>Semestre {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={fieldId + '-control-119'} className="block text-xs font-medium text-foreground mb-1">Periodo *</label>
            <input id={fieldId + '-control-119'}
              required
              placeholder="2026-A"
              value={form.periodo}
              onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive-foreground">{error}</p>}

          <Button variant="default"
            type="submit"
            className="w-full py-2.5 font-medium"
          >
            Continuar
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-accent border border-border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-primary-ink uppercase tracking-wide">Resumen del grupo a crear</p>
            <p className="text-3xl font-bold text-primary-ink">{preview?.nombre}</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Carrera:</span> {preview?.carrera?.nombre}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Semestre:</span> {preview?.semestre}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Periodo:</span> {preview?.periodo}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Materias de retícula:</span>{' '}
              {preview?.materias?.length > 0
                ? `Se asignarán automáticamente ${preview.materias.length} materias`
                : 'No se encontraron materias en la retícula para este semestre/carrera'}
            </p>
          </div>

          {error && <p className="text-sm text-destructive-foreground">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline"
              onClick={() => setStep('form')}
              className="flex-1 border py-2.5 font-medium"
            >
              Atrás
            </Button>
            <Button variant="default"
              onClick={handleConfirmar}
              disabled={loading}
              className="flex-1 py-2.5 font-medium disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
