import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { useId, useEffect, useState } from 'react'
import api from '../../../api/axios'

const FORM_VACIO = { nombre: '', edificio: '', capacidad: '' }

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.join(', ')
  return fallback
}

export default function AulasPage() {
  const fieldId = useId()
  const [aulas, setAulas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [form, setForm] = useState(FORM_VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  async function cargar() {
    setLoading(true)
    try {
      const res = await api.get('/aulas')
      setAulas(res.data)
      setError('')
    } catch (e) {
      setError(mensajeError(e, 'Error al cargar aulas'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function cancelarEdicion() {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre del aula es obligatorio')
      return
    }

    const payload = {
      nombre: form.nombre.trim(),
      ...(form.edificio.trim() ? { edificio: form.edificio.trim() } : {}),
      ...(form.capacidad ? { capacidad: Number(form.capacidad) } : {}),
    }

    setGuardando(true)
    setError('')
    try {
      if (editandoId) {
        await api.patch(`/aulas/${editandoId}`, payload)
      } else {
        await api.post('/aulas', payload)
      }
      cancelarEdicion()
      await cargar()
    } catch (e) {
      setError(mensajeError(e, 'Error al guardar el aula'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id) {
    setGuardando(true)
    setError('')
    try {
      await api.delete(`/aulas/${id}/permanente`)
      if (editandoId === id) cancelarEdicion()
      await cargar()
    } catch (e) {
      setError(mensajeError(e, 'Error al eliminar el aula'))
    } finally {
      setGuardando(false)
      setConfirmId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-ink sm:text-3xl">Aulas</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de aulas disponibles para asignar a los horarios de cada grupo.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          <span>{error}</span>
          <Button variant="destructive" onClick={() => setError('')} className="ml-4">
            ✕
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {editandoId ? 'Editar aula' : 'Nueva aula'}
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={fieldId + '-control-120'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nombre
            </label>
            <input id={fieldId + '-control-120'}
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Aula 101"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label htmlFor={fieldId + '-control-131'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Edificio
            </label>
            <input id={fieldId + '-control-131'}
              value={form.edificio}
              onChange={(e) => setForm((prev) => ({ ...prev, edificio: e.target.value }))}
              placeholder="Opcional"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label htmlFor={fieldId + '-control-142'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Capacidad
            </label>
            <input id={fieldId + '-control-142'}
              type="number"
              min="1"
              value={form.capacidad}
              onChange={(e) => setForm((prev) => ({ ...prev, capacidad: e.target.value }))}
              placeholder="Opcional"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="default"
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear aula'}
          </Button>
          {editandoId && (
            <Button variant="outline"
              type="button"
              onClick={cancelarEdicion}
              className="border px-4 py-2 text-sm"
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando aulas...</p>
      ) : aulas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay aulas registradas. Crea la primera para poder asignarla a un grupo.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {aulas.map((aula) => (
            <li
              key={aula.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{aula.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {aula.edificio || 'Sin edificio'}
                  {aula.capacidad ? ` · ${aula.capacidad} lugares` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline"
                  onClick={() => {
                    setEditandoId(aula.id)
                    setForm({
                      nombre: aula.nombre,
                      edificio: aula.edificio ?? '',
                      capacidad: aula.capacidad ? String(aula.capacidad) : '',
                    })
                    setError('')
                  }}
                  className="border px-3 py-1.5 text-xs"
                >
                  Editar
                </Button>
                <Button variant="destructive"
                  onClick={() => setConfirmId(aula.id)}
                  className="border px-3 py-1.5 text-xs"
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <Modal open onClose={() => setConfirmId(null)} title="¿Eliminar aula?" busy={guardando}>
            
            <p className="text-sm text-muted-foreground">
              El aula se borrará definitivamente. Las materias y los bloques de horario que la
              tenían asignada se conservan, pero quedan sin aula.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline"
                onClick={() => setConfirmId(null)}
                className="flex-1 border py-2 text-sm"
              >
                Cancelar
              </Button>
              <Button variant="destructive"
                onClick={() => handleEliminar(confirmId)}
                disabled={guardando}
                className="flex-1 py-2 text-sm disabled:opacity-50"
              >
                {guardando ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </Modal>
      )}
    </div>
  )
}
