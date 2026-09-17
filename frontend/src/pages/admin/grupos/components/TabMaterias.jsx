import { Button } from '@/components/ui/button'
import { notify } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'

const ESTADO_CONFIG = {
  ASIGNADA:   { label: 'Asignada',    cls: "bg-success/10 text-success-foreground" },
  DISPONIBLE: { label: 'Disponible',  cls: "bg-accent text-primary-ink" },
  FALTANTE:   { label: 'Sin materia', cls: "bg-warning/10 text-warning-foreground" },
}

export default function TabMaterias({ grupo, onAgregarClick }) {
  const { quitarMateria, agregarMaterias } = useGrupoStore()
  const [confirmId, setConfirmId] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  const [reticula, setReticula] = useState([])
  const [loadingReticula, setLoadingReticula] = useState(false)
  const [vistaReticula, setVistaReticula] = useState(true)

  useEffect(() => {
    if (!grupo?.id) return
    setLoadingReticula(true)
    api.get(`/grupos/${grupo.id}/reticula-status`)
      .then((r) => setReticula(r.data))
      .catch(() => setReticula([]))
      .finally(() => setLoadingReticula(false))
  }, [grupo?.id, grupo?.materias?.length])

  const handleQuitar = async (materiaId) => {
    setLoadingId(materiaId)
    try { await quitarMateria(grupo.id, materiaId) }
    finally { setLoadingId(null); setConfirmId(null) }
  }

  const handleAsignar = async (materiaId) => {
    setLoadingId(materiaId)
    try {
      await agregarMaterias(grupo.id, [materiaId])
    } catch (e) {
      notify(e.message)
    } finally {
      setLoadingId(null)
    }
  }

  const materias = grupo?.materias ?? []

  const totalReticula = reticula.length
  const asignadas   = reticula.filter((r) => r.estado === 'ASIGNADA').length
  const disponibles = reticula.filter((r) => r.estado === 'DISPONIBLE').length
  const faltantes   = reticula.filter((r) => r.estado === 'FALTANTE').length

  return (
    <div className="space-y-4">
      {/* Header con toggle de vista */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-max gap-1 rounded-xl bg-muted p-1">
          <Button variant="ghost"
            onClick={() => setVistaReticula(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              vistaReticula ? "bg-card text-primary-ink shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Retícula ({totalReticula})
          </Button>
          <Button variant="ghost"
            onClick={() => setVistaReticula(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !vistaReticula ? "bg-card text-primary-ink shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Asignadas ({materias.length})
          </Button>
        </div>
        <Button variant="default"
          onClick={onAgregarClick}
          className="w-full px-4 py-2 text-sm sm:w-auto"
        >
          + Agregar materias
        </Button>
      </div>

      {/* Resumen de estado */}
      {vistaReticula && totalReticula > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            <span className="text-muted-foreground">{asignadas} asignadas</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            <span className="text-muted-foreground">{disponibles} disponibles</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-warning/15 inline-block" />
            <span className="text-muted-foreground">{faltantes} sin materia creada</span>
          </div>
        </div>
      )}

      {/* Vista Retícula */}
      {vistaReticula && (
        loadingReticula ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando retícula...</p>
        ) : reticula.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay materias en la retícula para semestre {grupo.semestre} de esta carrera
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Materias del grupo">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-background text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Materia</th>
                  <th className="px-4 py-3 text-left">Clave</th>
                  <th className="px-4 py-3 text-center">HT-HP-CR</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reticula.map((rm) => {
                  const cfg = ESTADO_CONFIG[rm.estado]
                  return (
                    <tr key={rm.reticulaId} className="hover:bg-background">
                      <td className="px-4 py-3 font-medium text-foreground">{rm.nombre}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rm.clave}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {rm.horasTeoria}-{rm.horasPractica}-{rm.creditos}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rm.estado === 'DISPONIBLE' && (
                          <Button variant="outline"
                            onClick={() => handleAsignar(rm.materiaId)}
                            disabled={loadingId === rm.materiaId}
                            className="text-xs border px-2.5 py-1 disabled:opacity-50"
                          >
                            {loadingId === rm.materiaId ? '...' : 'Asignar'}
                          </Button>
                        )}
                        {rm.estado === 'ASIGNADA' && (
                          confirmId === rm.materiaId ? (
                            <span className="flex flex-wrap justify-end gap-1">
                              <Button variant="destructive"
                                onClick={() => handleQuitar(rm.materiaId)}
                                disabled={loadingId === rm.materiaId}
                                className="text-xs px-2.5 py-1 disabled:opacity-50"
                              >
                                Confirmar
                              </Button>
                              <Button variant="ghost"
                                onClick={() => setConfirmId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground px-2"
                              >
                                Cancelar
                              </Button>
                            </span>
                          ) : (
                            <Button variant="destructive"
                              onClick={() => setConfirmId(rm.materiaId)}
                              className="text-xs"
                            >
                              Quitar
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Vista Asignadas */}
      {!vistaReticula && (
        materias.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No hay materias asignadas</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Materias disponibles">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-background text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Materia</th>
                  <th className="px-4 py-3 text-left">Clave</th>
                  <th className="px-4 py-3 text-left">Horario</th>
                  <th className="px-4 py-3 text-left">Docente</th>
                  <th className="px-4 py-3 text-left">Aula</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {materias.map((m) => (
                  <tr key={m.id} className="hover:bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">{m.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.clave}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.dias ? (
                        <>
                          <span>{m.dias}</span>
                          <br />
                          <span className="text-xs text-muted-foreground">{m.horaInicio} – {m.horaFin}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin horario</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.docente
                        ? <span className="text-foreground">{m.docente.nombre}</span>
                        : <span className="text-xs bg-destructive/10 text-destructive-foreground px-2 py-0.5 rounded-full">Sin docente</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.aula
                        ? <span className="text-foreground">{m.aula.nombre}</span>
                        : <span className="text-xs bg-warning/10 text-warning-foreground px-2 py-0.5 rounded-full">Sin aula</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmId === m.id ? (
                        <span className="flex flex-wrap justify-end gap-2">
                          <Button variant="destructive"
                            onClick={() => handleQuitar(m.id)}
                            disabled={loadingId === m.id}
                            className="text-xs px-3 py-1 disabled:opacity-50"
                          >
                            Confirmar
                          </Button>
                          <Button variant="ghost"
                            onClick={() => setConfirmId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2"
                          >
                            Cancelar
                          </Button>
                        </span>
                      ) : (
                        <Button variant="destructive"
                          onClick={() => setConfirmId(m.id)}
                          className="text-xs"
                        >
                          Quitar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
