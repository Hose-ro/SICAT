import { useEffect, useState } from 'react'
import { useGrupoStore } from '../../../store/grupoStore'
import GrupoCard from './components/GrupoCard'
import FiltrosGrupo from './components/FiltrosGrupo'
import FormCrearGrupo from './components/FormCrearGrupo'

export default function GruposPage() {
  const { grupos, loading, error, cargarGrupos, clearError } = useGrupoStore()
  const [modalCrear, setModalCrear] = useState(false)

  useEffect(() => { cargarGrupos() }, [])

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
            <GrupoCard key={g.id} grupo={g} />
          ))}
        </div>
      )}

      {/* Modal crear */}
      <FormCrearGrupo open={modalCrear} onClose={() => setModalCrear(false)} />
    </div>
  )
}
