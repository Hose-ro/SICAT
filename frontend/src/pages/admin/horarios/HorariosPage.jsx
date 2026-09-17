import { Button } from '@/components/ui/button'
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

  const selectionKey = `${modo}:${docenteSeleccionado?.id ?? ''}:${grupoSeleccionado?.id ?? ''}`
  const [previousSelection, setPreviousSelection] = useState(selectionKey)
  if (previousSelection !== selectionKey) {
    setPreviousSelection(selectionKey)
    setEditor(null)
  }

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
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          {soloPropias ? 'Mi horario' : 'Gestión de Horarios'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {soloPropias
            ? 'Elige la materia y el grupo que vas a impartir. Si otro docente ya tiene esa materia en ese grupo, el sistema te avisa.'
            : 'Programa materias por docente y grupo con bloques por día y validación de conflictos'}
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          <span>{error}</span>
          <Button variant="destructive" onClick={clearError} className="ml-4">
            ✕
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
        {!soloPropias && (
          <>
            <Button variant="ghost"
              className={`rounded-lg border px-3 py-1.5 ${modo === 'docente' ? "border-border bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
              onClick={() => { setModo('docente'); setModoEdicion(false) }}
            >
              Vista por docente
            </Button>
            <Button variant="ghost"
              className={`rounded-lg border px-3 py-1.5 ${modo === 'grupo' ? "border-border bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
              onClick={() => { setModo('grupo'); setModoEdicion(false) }}
            >
              Vista por grupo
            </Button>
          </>
        )}

        {contexto && (
          <Button variant="ghost"
            onClick={alternarEdicion}
            className={`rounded-lg border px-3 py-1.5 sm:ml-auto ${
              modoEdicion
                ? "border-border bg-muted text-foreground"
                : "border-border bg-card text-primary-ink hover:bg-accent"
            }`}
          >
            {modoEdicion ? 'Salir de edición' : 'Editar horario'}
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto xl:w-72">
          {soloPropias ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Docente</p>
              <p className="mt-1 font-medium text-foreground">{docenteSeleccionado?.nombre ?? 'Tu horario'}</p>
            </div>
          ) : modo === 'docente' ? (
            <SelectorDocente />
          ) : (
            <SelectorGrupo />
          )}

          {modoEdicion && contexto && !editor && (
            <Button variant="outline"
              onClick={() => setEditor({ preset: null })}
              className="border border-dashed px-4 py-3 text-sm font-medium"
            >
              + Nueva clase
            </Button>
          )}
        </aside>

        <section aria-label="Cuadrícula del horario" className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card p-3 sm:p-4">
          <GridHorario
            modo={modo}
            modoEdicion={modoEdicion}
            claseEnEdicion={editor?.clase ?? null}
            onEditarClase={handleEditarClase}
            onNuevaClase={handleNuevaClase}
          />
        </section>

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
