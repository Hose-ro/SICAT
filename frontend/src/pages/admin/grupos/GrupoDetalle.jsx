import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGrupoStore } from '../../../store/grupoStore'
import TabAlumnos from './components/TabAlumnos'
import TabMaterias from './components/TabMaterias'
import TabHorario from './components/TabHorario'
import ModalAsignarAlumnos from './components/ModalAsignarAlumnos'
import ModalAgregarMaterias from './components/ModalAgregarMaterias'

export default function GrupoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { grupoActivo, loading, error, seleccionarGrupo, eliminarGrupo, clearError } = useGrupoStore()

  const [tab, setTab] = useState('alumnos')
  const [modalAlumnos, setModalAlumnos] = useState(false)
  const [modalMaterias, setModalMaterias] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  useEffect(() => { seleccionarGrupo(Number(id)) }, [id, seleccionarGrupo])

  const [eliminando, setEliminando] = useState(false)

  const handleEliminar = async () => {
    setEliminando(true)
    try {
      await eliminarGrupo(Number(id))
      navigate('/admin/grupos')
    } catch {
      // El store deja el mensaje: el grupo sigue abierto para reintentar.
      setConfirmEliminar(false)
    } finally {
      setEliminando(false)
    }
  }

  if (loading && !grupoActivo) {
    return <p className="text-sm text-muted-foreground p-6">Cargando...</p>
  }

  if (!grupoActivo) {
    return <p className="text-sm text-muted-foreground p-6">Grupo no encontrado.</p>
  }

  const tabs = [
    { key: 'alumnos', label: `Alumnos (${grupoActivo.alumnos?.length ?? 0})` },
    { key: 'materias', label: `Materias (${grupoActivo.materias?.length ?? 0})` },
    { key: 'horario', label: 'Horario' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost"
          onClick={() => navigate('/admin/grupos')}
          className="text-muted-foreground hover:text-muted-foreground text-xl mt-1"
        >
          ←
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-primary-ink sm:text-3xl">{grupoActivo.nombre}</h1>
            <span className="text-sm bg-accent text-primary-ink px-2.5 py-1 rounded-full font-medium">
              Sem. {grupoActivo.semestre}
            </span>
            <span className="text-xs text-muted-foreground">{grupoActivo.periodo}</span>
            {grupoActivo.modalidad === 'MIXTO' && (
              <span className="text-xs bg-primary/10 text-primary-ink px-2.5 py-1 rounded-full font-medium">
                Mixto
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{grupoActivo.carrera?.nombre}</p>
        </div>
        <Button variant="destructive"
          onClick={() => setConfirmEliminar(true)}
          className="text-xs border px-3 py-1.5"
        >
          Eliminar
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive-foreground flex items-center justify-between">
          <span>{error}</span>
          <Button variant="destructive" onClick={clearError} className="ml-4">✕</Button>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {tabs.map((t) => (
            <Button variant="ghost"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-card text-primary-ink shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Contenido del tab */}
      <div>
        {tab === 'alumnos' && (
          <TabAlumnos grupo={grupoActivo} onAgregarClick={() => setModalAlumnos(true)} />
        )}
        {tab === 'materias' && (
          <TabMaterias grupo={grupoActivo} onAgregarClick={() => setModalMaterias(true)} />
        )}
        {tab === 'horario' && <TabHorario grupo={grupoActivo} />}
      </div>

      {/* Modales */}
      <ModalAsignarAlumnos
        open={modalAlumnos}
        onClose={() => setModalAlumnos(false)}
        grupo={grupoActivo}
      />
      <ModalAgregarMaterias
        open={modalMaterias}
        onClose={() => setModalMaterias(false)}
        grupo={grupoActivo}
      />

      {/* Confirm eliminar */}
      {confirmEliminar && (
        <Modal open onClose={() => setConfirmEliminar(false)} title="¿Eliminar grupo?" busy={eliminando}>
            
            <p className="text-sm text-muted-foreground">
              El grupo <strong>{grupoActivo.nombre}</strong> se borrará definitivamente junto con su horario. Esta acción no se puede deshacer.
            </p>
            <p className="text-sm text-muted-foreground">
              Sus alumnos quedan sin grupo y el historial académico se conserva: las clases, tareas y calificaciones siguen registradas en cada materia.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline"
                onClick={() => setConfirmEliminar(false)}
                className="flex-1 border py-2 text-sm"
              >
                Cancelar
              </Button>
              <Button variant="destructive"
                onClick={handleEliminar}
                disabled={eliminando}
                className="flex-1 py-2 text-sm disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </Modal>
      )}
    </div>
  )
}
