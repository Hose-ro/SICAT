import { Button } from '@/components/ui/button'
import { useId, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'
import Modal from '../../../../components/Modal'
import { ETIQUETA_MODALIDAD, getCurrentAcademicPeriod } from '../../../../lib/periodo'

const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Escolarizado va de lunes a viernes; mixto sólo sábados, con su propio calendario. */
const MODALIDADES = [
  { valor: 'ESCOLARIZADO', descripcion: 'Lunes a viernes', ejemplo: '103-A' },
  { valor: 'MIXTO', descripcion: 'Sólo sábados', ejemplo: '103-SA' },
]

const FORM_INICIAL = () => ({
  nombre: '',
  carreraId: '',
  semestre: '',
  periodo: getCurrentAcademicPeriod(),
  modalidad: 'ESCOLARIZADO',
})

export default function FormCrearGrupo({ open, onClose }) {
  const fieldId = useId()
  const navigate = useNavigate()
  const { crearGrupo } = useGrupoStore()
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'confirm'

  useEffect(() => {
    if (open) {
      setForm(FORM_INICIAL())
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
        modalidad: form.modalidad,
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
          <fieldset>
            <legend className="block text-xs font-medium text-foreground mb-1">Modalidad *</legend>
            <div className="grid grid-cols-2 gap-2">
              {MODALIDADES.map((opcion) => {
                const activa = form.modalidad === opcion.valor
                return (
                  <label
                    key={opcion.valor}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors ${activa ? 'border-primary bg-primary/10 text-primary-ink' : 'border-border text-foreground hover:bg-muted/40'}`}
                  >
                    <input
                      type="radio"
                      name={fieldId + '-modalidad'}
                      value={opcion.valor}
                      checked={activa}
                      onChange={() => setForm({ ...form, modalidad: opcion.valor })}
                      className="sr-only"
                    />
                    <span className="block font-medium">{ETIQUETA_MODALIDAD[opcion.valor]}</span>
                    <span className="block text-xs text-muted-foreground">{opcion.descripcion} · ej. {opcion.ejemplo}</span>
                  </label>
                )
              })}
            </div>
            {form.modalidad === 'MIXTO' && (
              <p className="text-xs text-muted-foreground mt-1">
                Los grupos mixtos (sábados) llevan su propio calendario de inicio y fin de semestre.
              </p>
            )}
          </fieldset>

          <div>
            <label htmlFor={fieldId + '-control-76'} className="block text-xs font-medium text-foreground mb-1">Nombre del grupo *</label>
            <input id={fieldId + '-control-76'}
              required
              maxLength={20}
              placeholder={form.modalidad === 'MIXTO' ? '103-SA' : '103-A'}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {form.modalidad === 'MIXTO'
                ? 'Como lo nombra la institución, con la S antes de la letra: 103-SA, 103-SB…'
                : 'Como lo nombra la institución, por ejemplo 103-A o 103-B'}
            </p>
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
              <span className="font-medium">Modalidad:</span> {ETIQUETA_MODALIDAD[preview?.modalidad] ?? ETIQUETA_MODALIDAD.ESCOLARIZADO}
              {preview?.modalidad === 'MIXTO' ? ' (sólo sábados)' : ' (lunes a viernes)'}
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
