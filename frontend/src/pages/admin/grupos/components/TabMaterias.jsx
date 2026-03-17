import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'

const ESTADO_CONFIG = {
  ASIGNADA:   { label: 'Asignada',    cls: 'bg-green-100 text-green-700' },
  DISPONIBLE: { label: 'Disponible',  cls: 'bg-blue-100 text-blue-700' },
  FALTANTE:   { label: 'Sin materia', cls: 'bg-amber-100 text-amber-700' },
}

export default function TabMaterias({ grupo, onAgregarClick }) {
  const { quitarMateria, agregarMaterias, seleccionarGrupo } = useGrupoStore()
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
      alert(e.message)
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setVistaReticula(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              vistaReticula ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Retícula ({totalReticula})
          </button>
          <button
            onClick={() => setVistaReticula(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !vistaReticula ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Asignadas ({materias.length})
          </button>
        </div>
        <button
          onClick={onAgregarClick}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition"
        >
          + Agregar materias
        </button>
      </div>

      {/* Resumen de estado */}
      {vistaReticula && totalReticula > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-gray-600">{asignadas} asignadas</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            <span className="text-gray-600">{disponibles} disponibles</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="text-gray-600">{faltantes} sin materia creada</span>
          </div>
        </div>
      )}

      {/* Vista Retícula */}
      {vistaReticula && (
        loadingReticula ? (
          <p className="text-sm text-gray-400 py-6 text-center">Cargando retícula...</p>
        ) : reticula.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No hay materias en la retícula para semestre {grupo.semestre} de esta carrera
          </p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Materia</th>
                  <th className="px-4 py-3 text-left">Clave</th>
                  <th className="px-4 py-3 text-center">HT-HP-CR</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reticula.map((rm) => {
                  const cfg = ESTADO_CONFIG[rm.estado]
                  return (
                    <tr key={rm.reticulaId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{rm.nombre}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{rm.clave}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {rm.horasTeoria}-{rm.horasPractica}-{rm.creditos}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rm.estado === 'DISPONIBLE' && (
                          <button
                            onClick={() => handleAsignar(rm.materiaId)}
                            disabled={loadingId === rm.materiaId}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg disabled:opacity-50"
                          >
                            {loadingId === rm.materiaId ? '...' : 'Asignar'}
                          </button>
                        )}
                        {rm.estado === 'ASIGNADA' && (
                          confirmId === rm.materiaId ? (
                            <span className="flex justify-end gap-1">
                              <button
                                onClick={() => handleQuitar(rm.materiaId)}
                                disabled={loadingId === rm.materiaId}
                                className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setConfirmId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2"
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmId(rm.materiaId)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Quitar
                            </button>
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
          <p className="text-sm text-gray-400 py-8 text-center">No hay materias asignadas</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Materia</th>
                  <th className="px-4 py-3 text-left">Clave</th>
                  <th className="px-4 py-3 text-left">Horario</th>
                  <th className="px-4 py-3 text-left">Docente</th>
                  <th className="px-4 py-3 text-left">Aula</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materias.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{m.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.clave}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.dias ? (
                        <>
                          <span>{m.dias}</span>
                          <br />
                          <span className="text-xs text-gray-400">{m.horaInicio} – {m.horaFin}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin horario</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.docente
                        ? <span className="text-gray-700">{m.docente.nombre}</span>
                        : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Sin docente</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.aula
                        ? <span className="text-gray-700">{m.aula.nombre}</span>
                        : <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Sin aula</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmId === m.id ? (
                        <span className="flex justify-end gap-2">
                          <button
                            onClick={() => handleQuitar(m.id)}
                            disabled={loadingId === m.id}
                            className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmId(m.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Quitar
                        </button>
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
