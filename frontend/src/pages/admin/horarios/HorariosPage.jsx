import { useCallback, useEffect, useState } from 'react'
import { useHorarioStore } from '../../../store/horarioStore'
import SelectorDocente from './components/SelectorDocente'
import GridHorario from './components/GridHorario'
import SelectorGrupo from './components/SelectorGrupo'
import HorarioForm from './components/HorarioForm'

/**
 * Misma pantalla para el admin y para el docente. Con `soloPropias` el docente
 * queda fijado como contexto: programa, edita y borra únicamente sus clases.
 */
export default function HorariosPage({ soloPropias = false }) {
  const {
    cargarCatalogos,
    cargarMiHorario,
    error,
    clearError,
    docenteSeleccionado,
    grupoSeleccionado,
    eliminarClase,
  } = useHorarioStore()

  const [modo, setModo] = useState('docente') // 'docente' | 'grupo'
  const [modoEdicion, setModoEdicion] = useState(soloPropias)
  const [editor, setEditor] = useState(null) // { clase } | { preset } | null

  useEffect(() => {
    cargarCatalogos({ soloPropias })
    if (soloPropias) cargarMiHorario()
  }, [cargarCatalogos, cargarMiHorario, soloPropias])

  useEffect(() => {
    setModoEdicion(false)
    setEditor(null)
  }, [modo])

  useEffect(() => {
    setEditor(null)
  }, [docenteSeleccionado?.id, grupoSeleccionado?.id])

  const contexto = modo === 'grupo' ? grupoSeleccionado : docenteSeleccionado

  const cerrarEditor = useCallback(() => setEditor(null), [])

  const handleEditarClase = useCallback((clase) => {
    setModoEdicion(true)
    setEditor({ clase })
  }, [])

  const handleNuevaClase = useCallback((preset) => {
    setEditor({ preset })
  }, [])

  const handleEliminarClase = useCallback(
    async (clase) => {
      await eliminarClase(clase.horarioIds)
      setEditor(null)
    },
    [eliminarClase],
  )

  function alternarEdicion() {
    setModoEdicion((previo) => {
      if (previo) setEditor(null)
      return !previo
    })
  }

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">
          {soloPropias ? 'Mi horario' : 'Gestión de Horarios'}
        </h1>
        <p className="text-sm text-slate-500">
          {soloPropias
            ? 'Elige la materia y el grupo que vas a impartir. Si otro docente ya tiene esa materia en ese grupo, el sistema te avisa.'
            : 'Programa materias por docente y grupo con bloques por día y validación de conflictos'}
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={clearError} className="ml-4 text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
        {!soloPropias && (
          <>
            <button
              className={`rounded-lg border px-3 py-1.5 ${modo === 'docente' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600'}`}
              onClick={() => setModo('docente')}
            >
              Vista por docente
            </button>
            <button
              className={`rounded-lg border px-3 py-1.5 ${modo === 'grupo' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600'}`}
              onClick={() => setModo('grupo')}
            >
              Vista por grupo
            </button>
          </>
        )}

        {contexto && (
          <button
            onClick={alternarEdicion}
            className={`rounded-lg border px-3 py-1.5 sm:ml-auto ${
              modoEdicion
                ? 'border-slate-300 bg-slate-100 text-slate-700'
                : 'border-blue-600 bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            {modoEdicion ? 'Salir de edición' : 'Editar horario'}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto xl:w-72">
          {soloPropias ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Docente</p>
              <p className="mt-1 font-medium text-slate-800">{docenteSeleccionado?.nombre ?? 'Tu horario'}</p>
            </div>
          ) : modo === 'docente' ? (
            <SelectorDocente />
          ) : (
            <SelectorGrupo />
          )}

          {modoEdicion && contexto && !editor && (
            <button
              onClick={() => setEditor({ preset: null })}
              className="rounded-xl border border-dashed border-blue-300 px-4 py-3 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
            >
              + Nueva clase
            </button>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <GridHorario
            modo={modo}
            modoEdicion={modoEdicion}
            claseEnEdicion={editor?.clase ?? null}
            onEditarClase={handleEditarClase}
            onNuevaClase={handleNuevaClase}
          />
        </main>

        {editor && contexto && (
          <aside className="w-full shrink-0 overflow-y-auto xl:w-80">
            <HorarioForm
              modo={modo}
              soloPropias={soloPropias}
              clase={editor.clase ?? null}
              preset={editor.preset ?? null}
              onSaved={cerrarEditor}
              onCancelEdit={cerrarEditor}
              onEliminar={handleEliminarClase}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
