import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useGrupoStore } from '../../../store/grupoStore'
import GrupoCard from './components/GrupoCard'
import FiltrosGrupo from './components/FiltrosGrupo'
import FormCrearGrupo from './components/FormCrearGrupo'

export default function GruposPage() {
  const { grupos, loading, error, cargarGrupos, clearError } = useGrupoStore()
  const [modalCrear, setModalCrear] = useState(false)

  useEffect(() => { cargarGrupos() }, [cargarGrupos])

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
            <GrupoCard key={g.id} grupo={g} />
          ))}
        </div>
      )}

      {/* Modal crear */}
      <FormCrearGrupo open={modalCrear} onClose={() => setModalCrear(false)} />
    </div>
  )
}
