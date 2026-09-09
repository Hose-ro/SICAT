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

      {avisoLote && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{avisoLote}</span>
          <button onClick={() => setAvisoLote('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
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

      {aulas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {modoSeleccion ? (
            <>
              <span className="text-sm text-gray-500">
                {seleccionados.length} de {aulas.length} seleccionada(s)
              </span>
              <button
                onClick={alternarTodos}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
              >
                {todosSeleccionados ? 'Quitar selección' : 'Seleccionar todas'}
              </button>
              <button
                onClick={() => setConfirmLote(true)}
                disabled={seleccionados.length === 0}
                className="ml-auto rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Eliminar {seleccionados.length > 0 ? `(${seleccionados.length})` : ''}
              </button>
              <button
                onClick={salirDeSeleccion}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setModoSeleccion(true)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              Seleccionar
            </button>
          )}
        </div>
      )}

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
              <div className="flex min-w-0 items-center gap-3">
                {modoSeleccion && (
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(aula.id)}
                    onChange={() => alternarSeleccion(aula.id)}
                    className="h-4 w-4 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{aula.nombre}</p>
                  <p className="text-xs text-gray-500">
                    {aula.edificio || 'Sin edificio'}
                    {aula.capacidad ? ` · ${aula.capacidad} lugares` : ''}
                  </p>
                </div>
              </div>
              {!modoSeleccion && (
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
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold text-gray-800">¿Eliminar aula?</h3>
            <p className="text-sm text-gray-500">
              El aula se borrará definitivamente. Las materias y los bloques de horario que la
              tenían asignada se conservan, pero quedan sin aula.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-xl border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEliminar(confirmId)}
                disabled={guardando}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {guardando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLote && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold text-gray-800">¿Eliminar aulas seleccionadas?</h3>
            <p className="text-sm text-gray-500">
              Se eliminarán definitivamente {seleccionados.length} aula{seleccionados.length === 1 ? '' : 's'}. Las materias y los bloques de horario que las tenían asignadas se conservan, pero quedan sin aula.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setConfirmLote(false)}
                disabled={eliminandoLote}
                className="flex-1 rounded-xl border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarLote}
                disabled={eliminandoLote}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {eliminandoLote ? 'Eliminando...' : `Eliminar ${seleccionados.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
