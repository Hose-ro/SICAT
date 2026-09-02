import { useEffect, useState } from 'react'
import api from '../../../api/axios'

const FORM_VACIO = { nombre: '', edificio: '', capacidad: '' }

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.join(', ')
  return fallback
}

export default function AulasPage() {
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

  async function handleDesactivar(id) {
    setGuardando(true)
    setError('')
    try {
      await api.delete(`/aulas/${id}`)
      if (editandoId === id) cancelarEdicion()
      await cargar()
    } catch (e) {
      setError(mensajeError(e, 'Error al desactivar el aula'))
    } finally {
      setGuardando(false)
      setConfirmId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-600 sm:text-3xl">Aulas</h1>
        <p className="text-sm text-gray-500">
          Catálogo de aulas disponibles para asignar a los horarios de cada grupo.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800">
          {editandoId ? 'Editar aula' : 'Nueva aula'}
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nombre
            </label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Aula 101"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Edificio
            </label>
            <input
              value={form.edificio}
              onChange={(e) => setForm((prev) => ({ ...prev, edificio: e.target.value }))}
              placeholder="Opcional"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Capacidad
            </label>
            <input
              type="number"
              min="1"
              value={form.capacidad}
              onChange={(e) => setForm((prev) => ({ ...prev, capacidad: e.target.value }))}
              placeholder="Opcional"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear aula'}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={cancelarEdicion}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Cargando aulas...</p>
      ) : aulas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No hay aulas registradas. Crea la primera para poder asignarla a un grupo.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
          {aulas.map((aula) => (
            <li
              key={aula.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{aula.nombre}</p>
                <p className="text-xs text-gray-500">
                  {aula.edificio || 'Sin edificio'}
                  {aula.capacidad ? ` · ${aula.capacidad} lugares` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditandoId(aula.id)
                    setForm({
                      nombre: aula.nombre,
                      edificio: aula.edificio ?? '',
                      capacidad: aula.capacidad ? String(aula.capacidad) : '',
                    })
                    setError('')
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => setConfirmId(aula.id)}
                  className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:border-red-400 hover:bg-red-50"
                >
                  Desactivar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold text-gray-800">¿Desactivar aula?</h3>
            <p className="text-sm text-gray-500">
              El aula dejará de aparecer al asignar horarios. Los bloques que ya la usan la
              conservan.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-xl border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDesactivar(confirmId)}
                disabled={guardando}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
