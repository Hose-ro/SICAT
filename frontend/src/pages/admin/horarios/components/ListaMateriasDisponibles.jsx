import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'
import { hayConflictoHorario } from '../utils/conflictoHorario'

export default function ListaMateriasDisponibles() {
  const { materiasSinDocente, docenteSeleccionado, materias, asignarDocente } = useHorarioStore()
  const [busqueda, setBusqueda] = useState('')
  const [semestre, setSemestre] = useState('')
  const [soloMiAcademia, setSoloMiAcademia] = useState(true)
  const [loadingId, setLoadingId] = useState(null)
  const [errorId, setErrorId] = useState({})

  const academiasDocente = docenteSeleccionado?.academias?.map((a) => a.id) ?? []

  async function handleAsignar(materia) {
    if (!docenteSeleccionado) return
    setLoadingId(materia.id)
    setErrorId((prev) => ({ ...prev, [materia.id]: null }))
    try {
      await asignarDocente(materia.id, docenteSeleccionado.id)
    } catch (e) {
      setErrorId((prev) => ({ ...prev, [materia.id]: e.message }))
    } finally {
      setLoadingId(null)
    }
  }

  function getEstado(materia) {
    if (!docenteSeleccionado) return 'sin-seleccion'
    const conflicto = materias.some((m) => hayConflictoHorario(materia, m))
    return conflicto ? 'conflicto' : 'libre'
  }

  const semestres = [...new Set(materiasSinDocente.map((m) => m.semestre).filter(Boolean))].sort()

  const filtradas = materiasSinDocente.filter((m) => {
    const matchBusqueda = m.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchSemestre = semestre ? String(m.semestre) === semestre : true
    const academiasMateria = m.academias?.map((a) => a.id) ?? []
    const matchAcademia =
      !soloMiAcademia ||
      !docenteSeleccionado ||
      academiasMateria.length === 0 ||
      academiasDocente.some((id) => academiasMateria.includes(id))
    return matchBusqueda && matchSemestre && matchAcademia
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <input aria-label="Buscar materia"
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar materia..."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {semestres.length > 0 && (
          <select aria-label="Semestre"
            value={semestre}
            onChange={(e) => setSemestre(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos los semestres</option>
            {semestres.map((s) => (
              <option key={s} value={s}>Semestre {s}</option>
            ))}
          </select>
        )}
        {docenteSeleccionado && academiasDocente.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={soloMiAcademia}
              onChange={(e) => setSoloMiAcademia(e.target.checked)}
              className="accent-primary"
            />
            Solo materias de mis academias
          </label>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{filtradas.length} materia{filtradas.length !== 1 ? 's' : ''} sin docente</p>

      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {filtradas.map((materia) => {
          const estado = getEstado(materia)
          const error = errorId[materia.id]

          return (
            <div
              key={materia.id}
              className="border border-border rounded-lg p-3 space-y-2 bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{materia.nombre}</p>
                  <p className="text-xs text-muted-foreground">{materia.clave}</p>
                </div>
                <EstadoBadge estado={estado} />
              </div>

              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{materia.dias}</p>
                <p>{materia.horaInicio} – {materia.horaFin}</p>
                {materia.semestre && <p>Semestre {materia.semestre}</p>}
                {materia.carrera && <p>{materia.carrera.nombre}</p>}
                {materia.grupos?.length > 0 && (
                  <p>Grupos: {materia.grupos.map((g) => g.nombre).join(', ')}</p>
                )}
                {materia.academias?.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {materia.academias.map((a) => {
                      const esCompartida = academiasDocente.includes(a.id)
                      return (
                        <span
                          key={a.id}
                          className={`px-1.5 py-0.5 rounded-full text-xs ${
                            esCompartida
                              ? "bg-success/10 text-success-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.nombre}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-warning-foreground italic">Sin academia</span>
                )}
              </div>

              {error && (
                <p className="text-xs text-destructive-foreground bg-destructive/10 rounded p-1.5">{error}</p>
              )}

              <Button variant="default"
                onClick={() => handleAsignar(materia)}
                disabled={!docenteSeleccionado || estado === 'conflicto' || loadingId === materia.id}
                className="w-full text-xs font-medium py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loadingId === materia.id
                  ? 'Asignando...'
                  : docenteSeleccionado
                  ? estado === 'conflicto'
                    ? 'Conflicto de horario'
                    : 'Asignar al docente'
                  : 'Selecciona un docente'}
              </Button>
            </div>
          )
        })}

        {filtradas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay materias sin docente
          </p>
        )}
      </div>
    </div>
  )
}

function EstadoBadge({ estado }) {
  if (estado === 'libre') return (
    <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/10 text-success-foreground whitespace-nowrap">
      Sin conflicto
    </span>
  )
  if (estado === 'conflicto') return (
    <span className="text-xs px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive-foreground whitespace-nowrap">
      Conflicto
    </span>
  )
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
      —
    </span>
  )
}
