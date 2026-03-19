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

  useEffect(() => { seleccionarGrupo(Number(id)) }, [id])

  const handleEliminar = async () => {
    await eliminarGrupo(Number(id))
    navigate('/admin/grupos')
  }

  if (loading && !grupoActivo) {
    return <p className="text-sm text-gray-400 p-6">Cargando...</p>
  }

  if (!grupoActivo) {
    return <p className="text-sm text-gray-400 p-6">Grupo no encontrado.</p>
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
        <button
          onClick={() => navigate('/admin/grupos')}
          className="text-gray-400 hover:text-gray-600 text-xl mt-1"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-blue-600 sm:text-3xl">{grupoActivo.nombre}</h1>
            <span className="text-sm bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
              Sem. {grupoActivo.semestre}
            </span>
            <span className="text-xs text-gray-400">{grupoActivo.periodo}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{grupoActivo.carrera?.nombre}</p>
        </div>
        <button
          onClick={() => setConfirmEliminar(true)}
          className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-xl transition"
        >
          Desactivar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-1 rounded-xl bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold text-gray-800">¿Desactivar grupo?</h3>
            <p className="text-sm text-gray-500">
              El grupo <strong>{grupoActivo.nombre}</strong> quedará inactivo. Podrás reactivarlo manualmente desde la base de datos.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setConfirmEliminar(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm hover:bg-red-700 transition"
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
