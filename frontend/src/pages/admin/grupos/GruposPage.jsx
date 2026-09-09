import { useEffect, useState } from 'react'
import { useGrupoStore } from '../../../store/grupoStore'
import GrupoCard from './components/GrupoCard'
import FiltrosGrupo from './components/FiltrosGrupo'
import FormCrearGrupo from './components/FormCrearGrupo'

export default function GruposPage() {
  const { grupos, loading, error, cargarGrupos, eliminarGrupos, clearError } = useGrupoStore()
  const [modalCrear, setModalCrear] = useState(false)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [avisoLote, setAvisoLote] = useState('')

  useEffect(() => { cargarGrupos() }, [])

  const salirDeSeleccion = () => {
    setModoSeleccion(false)
    setSeleccionados([])
  }

  const alternarSeleccion = (id) => {
    setSeleccionados((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ))
  }

  const todosSeleccionados = grupos.length > 0 && seleccionados.length === grupos.length

  const alternarTodos = () => {
    setSeleccionados(todosSeleccionados ? [] : grupos.map((g) => g.id))
  }

  const handleEliminarLote = async () => {
    setEliminando(true)
    try {
      const data = await eliminarGrupos(seleccionados)
      setConfirmEliminar(false)
      salirDeSeleccion()
      const detalleErrores = data.errores?.length
        ? ` ${data.errores.length} no se pudieron eliminar: ${data.errores.map((e) => e.motivo).join('; ')}.`
        : ''
      setAvisoLote(`Se eliminaron ${data.eliminados} de ${data.eliminados + data.errores.length} grupo(s).${detalleErrores}`)
    } catch {
      // el error ya queda en el store (useGrupoStore().error) y se muestra abajo
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grupos</h1>
          <p className="text-sm text-gray-500">Gestiona los grupos de alumnos por carrera y semestre</p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          + Crear grupo
        </button>
      </div>

      {/* Filtros */}
      <FiltrosGrupo />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {avisoLote && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800 flex items-start justify-between gap-3">
          <span>{avisoLote}</span>
          <button onClick={() => setAvisoLote('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Selección múltiple */}
      {grupos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {modoSeleccion ? (
            <>
              <span className="text-sm text-gray-500">
                {seleccionados.length} de {grupos.length} seleccionado(s)
              </span>
              <button
                onClick={alternarTodos}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
              >
                {todosSeleccionados ? 'Quitar selección' : 'Seleccionar todos'}
              </button>
              <button
                onClick={() => setConfirmEliminar(true)}
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

      {/* Lista */}
      {loading && grupos.length === 0 ? (
        <p className="text-sm text-gray-400">Cargando grupos...</p>
      ) : grupos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No hay grupos registrados</p>
          <p className="text-sm mt-1">Crea el primer grupo con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {grupos.map((g) => (
            <GrupoCard
              key={g.id}
              grupo={g}
              seleccionable={modoSeleccion}
              seleccionado={seleccionados.includes(g.id)}
              onToggleSeleccion={alternarSeleccion}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      <FormCrearGrupo open={modalCrear} onClose={() => setModalCrear(false)} />

      {/* Confirm eliminar en lote */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold text-gray-800">¿Eliminar grupos seleccionados?</h3>
            <p className="text-sm text-gray-500">
              Se eliminarán definitivamente {seleccionados.length} grupo{seleccionados.length === 1 ? '' : 's'} junto con su horario. Esta acción no se puede deshacer.
            </p>
            <p className="text-sm text-gray-500">
              Sus alumnos quedan sin grupo y el historial académico se conserva: las clases, tareas y calificaciones siguen registradas en cada materia.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setConfirmEliminar(false)}
                disabled={eliminando}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarLote}
                disabled={eliminando}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm hover:bg-red-700 transition disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : `Eliminar ${seleccionados.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
