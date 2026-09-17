import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
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

  useEffect(() => { cargarGrupos() }, [cargarGrupos])

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
          <h1 className="text-2xl font-bold text-foreground">Grupos</h1>
          <p className="text-sm text-muted-foreground">Gestiona los grupos de alumnos por carrera y semestre</p>
        </div>
        <Button variant="default"
          onClick={() => setModalCrear(true)}
          className="px-4 py-2 text-sm font-medium"
        >
          + Crear grupo
        </Button>
      </div>

      {/* Filtros */}
      <FiltrosGrupo />

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive-foreground flex items-center justify-between">
          <span>{error}</span>
          <Button variant="destructive" onClick={clearError} className="ml-4">✕</Button>
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

      {/* Selección múltiple */}
      {grupos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {modoSeleccion ? (
            <>
              <span className="text-sm text-muted-foreground">
                {seleccionados.length} de {grupos.length} seleccionado(s)
              </span>
              <Button variant="link" type="button" onClick={alternarTodos} className="px-0 text-sm">
                {todosSeleccionados ? 'Quitar selección' : 'Seleccionar todos'}
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={() => setConfirmEliminar(true)}
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

      {/* Lista */}
      {loading && grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cargando grupos...</p>
      ) : grupos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
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
        <Modal open onClose={() => setConfirmEliminar(false)} title="¿Eliminar grupos seleccionados?" busy={eliminando}>
          <p className="text-sm text-muted-foreground">
            Se eliminarán definitivamente {seleccionados.length} grupo{seleccionados.length === 1 ? '' : 's'} junto con su horario. Esta acción no se puede deshacer.
          </p>
          <p className="text-sm text-muted-foreground">
            Sus alumnos quedan sin grupo y el historial académico se conserva: las clases, tareas y calificaciones siguen registradas en cada materia.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline"
              onClick={() => setConfirmEliminar(false)}
              disabled={eliminando}
              className="flex-1 border py-2 text-sm disabled:opacity-50"
            >
              Cancelar
            </Button>
            <Button variant="destructive"
              onClick={handleEliminarLote}
              disabled={eliminando}
              className="flex-1 py-2 text-sm disabled:opacity-50"
            >
              {eliminando ? 'Eliminando...' : `Eliminar ${seleccionados.length}`}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
