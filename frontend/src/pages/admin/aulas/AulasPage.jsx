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

  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [confirmLote, setConfirmLote] = useState(false)
  const [eliminandoLote, setEliminandoLote] = useState(false)
  const [avisoLote, setAvisoLote] = useState('')

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

  function salirDeSeleccion() {
    setModoSeleccion(false)
    setSeleccionados([])
  }

  function alternarSeleccion(id) {
    setSeleccionados((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ))
  }

  const todosSeleccionados = aulas.length > 0 && seleccionados.length === aulas.length

  function alternarTodos() {
    setSeleccionados(todosSeleccionados ? [] : aulas.map((a) => a.id))
  }

  async function handleEliminarLote() {
    setEliminandoLote(true)
    setError('')
    try {
      const { data } = await api.delete('/aulas/lote', { data: { aulaIds: seleccionados } })
      setConfirmLote(false)
      salirDeSeleccion()
      const detalleErrores = data.errores?.length
        ? ` ${data.errores.length} no se pudieron eliminar: ${data.errores.map((e) => e.motivo).join('; ')}.`
        : ''
      setAvisoLote(`Se eliminaron ${data.eliminados} de ${data.eliminados + data.errores.length} aula(s).${detalleErrores}`)
      await cargar()
    } catch (e) {
      setError(mensajeError(e, 'Error al eliminar las aulas seleccionadas'))
    } finally {
      setEliminandoLote(false)
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

      {avisoLote && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground">
          <span>{avisoLote}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setAvisoLote('')} aria-label="Cerrar aviso">
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

      {aulas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {modoSeleccion ? (
            <>
              <span className="text-sm text-muted-foreground">
                {seleccionados.length} de {aulas.length} seleccionada(s)
              </span>
              <Button variant="link" type="button" onClick={alternarTodos} className="px-0 text-sm">
                {todosSeleccionados ? 'Quitar selección' : 'Seleccionar todas'}
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={() => setConfirmLote(true)}
                disabled={seleccionados.length === 0}
                className="ml-auto px-3 py-1.5 text-sm disabled:cursor-not-allowed"
              >
                Eliminar {seleccionados.length > 0 ? `(${seleccionados.length})` : ''}
              </Button>
              <Button variant="outline" type="button" onClick={salirDeSeleccion} className="border px-3 py-1.5 text-sm">
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="ghost" type="button" onClick={() => setModoSeleccion(true)} className="px-3 py-1.5 text-sm text-muted-foreground">
              Seleccionar
            </Button>
          )}
        </div>
      )}

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
              <div className="flex min-w-0 items-center gap-3">
                {modoSeleccion && (
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(aula.id)}
                    onChange={() => alternarSeleccion(aula.id)}
                    aria-label={`Seleccionar ${aula.nombre}`}
                    className="h-4 w-4 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{aula.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {aula.edificio || 'Sin edificio'}
                    {aula.capacidad ? ` · ${aula.capacidad} lugares` : ''}
                  </p>
                </div>
              </div>
              {!modoSeleccion && (
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
              )}
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

      {confirmLote && (
        <Modal open onClose={() => setConfirmLote(false)} title="¿Eliminar aulas seleccionadas?" busy={eliminandoLote}>
          <p className="text-sm text-muted-foreground">
            Se eliminarán definitivamente {seleccionados.length} aula{seleccionados.length === 1 ? '' : 's'}. Las materias y los bloques de horario que las tenían asignadas se conservan, pero quedan sin aula.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline"
              onClick={() => setConfirmLote(false)}
              disabled={eliminandoLote}
              className="flex-1 border py-2 text-sm disabled:opacity-50"
            >
              Cancelar
            </Button>
            <Button variant="destructive"
              onClick={handleEliminarLote}
              disabled={eliminandoLote}
              className="flex-1 py-2 text-sm disabled:opacity-50"
            >
              {eliminandoLote ? 'Eliminando...' : `Eliminar ${seleccionados.length}`}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
