import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useId, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleX as CiCircleRemove, BookOpen as CiRead, School as CiShop, UserRound as CiUser } from 'lucide-react'
import { useAcademiaStore } from '../../../store/academiaStore'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'

export default function AcademiasPage() {
  const fieldId = useId()
  const navigate = useNavigate()
  const { academias, loading, error, cargarAcademias, crearAcademia, eliminarAcademia, clearError } =
    useAcademiaStore()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => { cargarAcademias() }, [cargarAcademias])

  const handleCrear = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      await crearAcademia(form)
      setModal(false)
      setForm({ nombre: '', descripcion: '' })
    } catch (err) {
      setFormError(err.message)
    }
  }

  const handleEliminar = useAsyncAction(async (id, nombre) => {
    if (!(await confirmAction(`¿Desactivar la academia "${nombre}"?`))) return
    await eliminarAcademia(id)
  })

  return (
    <>
      <PageHeader
        title="Academias"
        subtitle="Grupos de docentes por área de conocimiento"
        action={
          <Button variant="default"
            onClick={() => { setModal(true); setFormError(''); setForm({ nombre: '', descripcion: '' }) }}
            className="px-4 py-2 text-sm font-medium"
          >
            + Nueva academia
          </Button>
        }
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive-foreground flex items-center justify-between mb-4">
          <span>{error}</span>
          <Button variant="destructive" onClick={clearError} className="ml-4" type="button" aria-label="Cerrar error">
            <CiCircleRemove className="h-5 w-5" />
          </Button>
        </div>
      )}

      {loading && academias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cargando academias...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {academias.map((a) => (
            <div
              key={a.id}
              className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary-ink">
                    <CiShop className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{a.nombre}</p>
                    {a.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5">{a.descripcion}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CiUser className="h-4 w-4" />
                  {a._count.docentes} docente{a._count.docentes !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <CiRead className="h-4 w-4" />
                  {a._count.materias} materia{a._count.materias !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-border">
                <Button variant="ghost"
                  onClick={() => navigate(`/admin/academias/${a.id}`)}
                  className="flex-1 text-xs font-medium text-primary-ink hover:text-primary-ink hover:bg-accent py-1.5"
                >
                  Ver detalle
                </Button>
                <Button variant="destructive"
                  onClick={() => handleEliminar(a.id, a.nombre)}
                  className="text-xs font-medium px-3 py-1.5"
                >
                  Desactivar
                </Button>
              </div>
            </div>
          ))}

          {academias.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
              No hay academias registradas. Crea la primera.
            </p>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva academia">
        <form onSubmit={handleCrear} className="space-y-4">
          <div>
            <label htmlFor={fieldId + '-control-124'} className="block text-xs font-medium text-foreground mb-1">Nombre *</label>
            <input id={fieldId + '-control-124'}
              required
              minLength={3}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Ciencias Básicas"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label htmlFor={fieldId + '-control-135'} className="block text-xs font-medium text-foreground mb-1">Descripción (opcional)</label>
            <input id={fieldId + '-control-135'}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Matemáticas, física y química"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {formError && <p className="text-sm text-destructive-foreground">{formError}</p>}
          <Button variant="default"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear academia'}
          </Button>
        </form>
      </Modal>
    </>
  )
}
