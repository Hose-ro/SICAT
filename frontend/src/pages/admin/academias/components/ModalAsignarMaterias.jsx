import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useAcademiaStore } from '../../../../store/academiaStore'
import Modal from '../../../../components/Modal'

export default function ModalAsignarMaterias({ open, onClose, academia }) {
  const { asignarMaterias } = useAcademiaStore()
  const [todasMaterias, setTodasMaterias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroSemestre, setFiltroSemestre] = useState('')
  const [seleccionadas, setSeleccionadas] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const idsAsignadas = new Set(academia.materias?.map((m) => m.id) ?? [])

  useEffect(() => {
    if (open) {
      api.get('/materias').then((res) => setTodasMaterias(res.data))
      setSeleccionadas([])
      setBusqueda('')
      setFiltroSemestre('')
      setError('')
    }
  }, [open])

  const semestres = [...new Set(todasMaterias.map((m) => m.semestre).filter(Boolean))].sort(
    (a, b) => a - b,
  )

  const disponibles = todasMaterias.filter((m) => {
    if (idsAsignadas.has(m.id)) return false
    const matchBusqueda =
      m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.clave.toLowerCase().includes(busqueda.toLowerCase())
    const matchSemestre = filtroSemestre ? String(m.semestre) === filtroSemestre : true
    return matchBusqueda && matchSemestre
  })

  const toggleSeleccion = (id) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleAsignar = async () => {
    if (seleccionadas.length === 0) return
    setLoading(true)
    setError('')
    try {
      await asignarMaterias(academia.id, seleccionadas)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar materias a la academia">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input aria-label="Buscar por nombre o clave"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o clave..."
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {semestres.length > 0 && (
            <select aria-label="Semestre"
              value={filtroSemestre}
              onChange={(e) => setFiltroSemestre(e.target.value)}
              className="border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              {semestres.map((s) => (
                <option key={s} value={s}>
                  S{s}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
          {disponibles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {todasMaterias.length === 0 ? 'Cargando...' : 'No hay materias disponibles'}
            </p>
          )}
          {disponibles.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-background cursor-pointer"
            >
              <input
                type="checkbox"
                checked={seleccionadas.includes(m.id)}
                onChange={() => toggleSeleccion(m.id)}
                className="accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{m.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {m.clave}
                  {m.semestre ? ` • Semestre ${m.semestre}` : ''}
                </p>
              </div>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-destructive-foreground">{error}</p>}

        <Button variant="default"
          onClick={handleAsignar}
          disabled={seleccionadas.length === 0 || loading}
          className="w-full py-2.5 font-medium disabled:opacity-50"
        >
          {loading
            ? 'Asignando...'
            : `Asignar ${seleccionadas.length > 0 ? `(${seleccionadas.length})` : 'seleccionadas'}`}
        </Button>
      </div>
    </Modal>
  )
}
