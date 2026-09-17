import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'
import Modal from '../../../../components/Modal'

export default function ModalAsignarAlumnos({ open, onClose, grupo }) {
  const { asignarAlumnos } = useGrupoStore()
  const [todosAlumnos, setTodosAlumnos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const idsEnGrupo = new Set(grupo?.alumnos?.map((a) => a.id) ?? [])

  useEffect(() => {
    if (open && grupo) {
      api
        .get('/usuarios', { params: { rol: 'ALUMNO' } })
        .then((res) =>
          setTodosAlumnos(
            res.data.filter(
              (u) =>
                u.rol === 'ALUMNO' &&
                u.activo &&
                (u.carreraId ?? u.carrera?.id) === grupo.carreraId
            )
          )
        )
        .catch(() => {})
      setSeleccionados([])
      setBusqueda('')
      setError('')
    }
  }, [open, grupo])

  const disponibles = todosAlumnos.filter(
    (a) =>
      !idsEnGrupo.has(a.id) &&
      (a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (a.numeroControl ?? '').toLowerCase().includes(busqueda.toLowerCase()))
  )

  const yaEnOtroGrupo = (a) => a.grupoId != null && a.grupoId !== grupo?.id

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAsignar = async () => {
    if (seleccionados.length === 0) return
    setLoading(true)
    setError('')
    try {
      await asignarAlumnos(grupo.id, seleccionados)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar alumnos al grupo">
      <div className="space-y-3">
        <input aria-label="Buscar por nombre o número de control"
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o número de control..."
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
          {todosAlumnos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
          )}
          {todosAlumnos.length > 0 && disponibles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay alumnos disponibles para agregar
            </p>
          )}
          {disponibles.map((a) => {
            const bloqueado = yaEnOtroGrupo(a)
            return (
              <label
                key={a.id}
                title={bloqueado ? 'Ya está en otro grupo' : undefined}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg ${
                  bloqueado ? 'opacity-40 cursor-not-allowed' : "hover:bg-background cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={bloqueado}
                  checked={seleccionados.includes(a.id)}
                  onChange={() => toggleSeleccion(a.id)}
                  className="accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{a.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.numeroControl && <span>{a.numeroControl} · </span>}
                    {bloqueado ? (
                      <span className="text-warning-foreground">Ya en otro grupo</span>
                    ) : (
                      a.email
                    )}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {error && <p className="text-sm text-destructive-foreground">{error}</p>}

        <Button variant="default"
          onClick={handleAsignar}
          disabled={seleccionados.length === 0 || loading}
          className="w-full py-2.5 font-medium disabled:opacity-50"
        >
          {loading
            ? 'Asignando...'
            : `Asignar${seleccionados.length > 0 ? ` (${seleccionados.length})` : ''}`}
        </Button>
      </div>
    </Modal>
  )
}
