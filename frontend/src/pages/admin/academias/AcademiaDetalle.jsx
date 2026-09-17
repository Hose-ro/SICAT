import { Button } from '@/components/ui/button'
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

  useEffect(() => { seleccionarAcademia(Number(id)) }, [id, seleccionarAcademia])

  if (loading && !academiaActiva) {
    return <p className="text-sm text-muted-foreground p-6">Cargando...</p>
  }

  if (!academiaActiva) {
    return <p className="text-sm text-muted-foreground p-6">Academia no encontrada.</p>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost"
          onClick={() => navigate('/admin/academias')}
          className="text-muted-foreground hover:text-muted-foreground text-xl"
        >
          ←
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{academiaActiva.nombre}</h1>
          {academiaActiva.descripcion && (
            <p className="text-sm text-muted-foreground">{academiaActiva.descripcion}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive-foreground flex items-center justify-between">
          <span>{error}</span>
          <Button variant="destructive" onClick={clearError} className="ml-4">✕</Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        <Button variant="ghost"
          onClick={() => setTab('docentes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'docentes'
              ? "bg-card text-primary-ink shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Docentes ({academiaActiva.docentes?.length ?? 0})
        </Button>
        <Button variant="ghost"
          onClick={() => setTab('materias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'materias'
              ? "bg-card text-primary-ink shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Materias ({academiaActiva.materias?.length ?? 0})
        </Button>
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
