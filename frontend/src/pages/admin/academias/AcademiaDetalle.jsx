import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAcademiaStore } from '../../../store/academiaStore'
import ListaDocentesAcademia from './components/ListaDocentesAcademia'
import ListaMateriasAcademia from './components/ListaMateriasAcademia'
import ModalAsignarDocentes from './components/ModalAsignarDocentes'
import ModalAsignarMaterias from './components/ModalAsignarMaterias'

export default function AcademiaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { academiaActiva, loading, error, seleccionarAcademia, clearError } = useAcademiaStore()

  const [tab, setTab] = useState('docentes')
  const [modalDocentes, setModalDocentes] = useState(false)
  const [modalMaterias, setModalMaterias] = useState(false)

  useEffect(() => { seleccionarAcademia(Number(id)) }, [id])

  if (loading && !academiaActiva) {
    return <p className="text-sm text-gray-400 p-6">Cargando...</p>
  }

  if (!academiaActiva) {
    return <p className="text-sm text-gray-400 p-6">Academia no encontrada.</p>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/academias')}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{academiaActiva.nombre}</h1>
          {academiaActiva.descripcion && (
            <p className="text-sm text-gray-400">{academiaActiva.descripcion}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('docentes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'docentes'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Docentes ({academiaActiva.docentes?.length ?? 0})
        </button>
        <button
          onClick={() => setTab('materias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'materias'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Materias ({academiaActiva.materias?.length ?? 0})
        </button>
      </div>

      {/* Content */}
      {tab === 'docentes' && (
        <ListaDocentesAcademia
          academia={academiaActiva}
          onAgregarClick={() => setModalDocentes(true)}
        />
      )}
      {tab === 'materias' && (
        <ListaMateriasAcademia
          academia={academiaActiva}
          onAgregarClick={() => setModalMaterias(true)}
        />
      )}

      {/* Modales */}
      <ModalAsignarDocentes
        open={modalDocentes}
        onClose={() => setModalDocentes(false)}
        academia={academiaActiva}
      />
      <ModalAsignarMaterias
        open={modalMaterias}
        onClose={() => setModalMaterias(false)}
        academia={academiaActiva}
      />
    </div>
  )
}
