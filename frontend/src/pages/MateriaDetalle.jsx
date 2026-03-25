import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'

const ESTADO_COLORS = {
  PENDIENTE: 'bg-gray-100 text-gray-500',
  ACTIVA: 'bg-green-100 text-green-700',
  FINALIZADA: 'bg-blue-100 text-blue-700',
}

export default function MateriaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [materia, setMateria] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tabActivo, setTabActivo] = useState('unidades')
  const [modalTarea, setModalTarea] = useState({ open: false, unidadId: null })
  const [modalAsistencia, setModalAsistencia] = useState({ open: false, claseId: null, alumnos: [] })
  const [asistencias, setAsistencias] = useState({})
  const [tarea, setTarea] = useState({ titulo: '', instrucciones: '', tipoEntrega: 'ONLINE', requiereFirma: false, fechaLimite: '' })
  const [solicitudes, setSolicitudes] = useState([])
  const [mensajeDenegar, setMensajeDenegar] = useState({ open: false, solicitudId: null, texto: '' })

  const esDocente = user?.rol === 'DOCENTE' || user?.rol === 'ADMIN'

  const fetchMateria = () => {
    setLoading(true)
    api.get(`/materias/${id}`).then((r) => {
      setMateria(r.data)
      setSolicitudes(r.data.solicitudes ?? [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchMateria() }, [id])

  const iniciarClase = async (unidadId, tema) => {
    try {
      await api.post(`/clases/unidad/${unidadId}/iniciar`, { tema: tema || undefined })
      fetchMateria()
    } catch (err) {
      alert(err.response?.data?.message ?? 'Error')
    }
  }

  const finalizarClase = async (claseId) => {
    await api.patch(`/clases/${claseId}/finalizar`)
    fetchMateria()
  }

  const iniciarUnidad = async (unidadId) => {
    await api.patch(`/unidades/${unidadId}/iniciar`)
    fetchMateria()
  }

  const finalizarUnidad = async (unidadId) => {
    await api.patch(`/unidades/${unidadId}/finalizar`)
    fetchMateria()
  }

  const abrirAsistencia = (claseId) => {
    const alumnos = materia.inscripciones.map((i) => i.alumno)
    const init = {}
    alumnos.forEach((a) => (init[a.id] = 'PRESENTE'))
    setAsistencias(init)
    setModalAsistencia({ open: true, claseId, alumnos })
  }

  const guardarAsistencia = async () => {
    await api.post('/asistencias', {
      claseId: modalAsistencia.claseId,
      asistencias: modalAsistencia.alumnos.map((a) => ({ alumnoId: a.id, tipo: asistencias[a.id] })),
    })
    setModalAsistencia({ open: false, claseId: null, alumnos: [] })
    fetchMateria()
  }

  const crearTarea = async (e) => {
    e.preventDefault()
    await api.post('/tareas', { ...tarea, unidadId: modalTarea.unidadId })
    setModalTarea({ open: false, unidadId: null })
    setTarea({ titulo: '', instrucciones: '', tipoEntrega: 'ONLINE', requiereFirma: false, fechaLimite: '' })
    fetchMateria()
  }

  const responderSolicitud = async (solicitudId, aprobar, mensaje) => {
    await api.patch(`/solicitudes/${solicitudId}/responder`, { aprobar, mensaje: mensaje || undefined })
    fetchMateria()
  }

  const abrirDenegar = (solicitudId) => {
    setMensajeDenegar({ open: true, solicitudId, texto: '' })
  }

  const confirmarDenegar = async () => {
    await responderSolicitud(mensajeDenegar.solicitudId, false, mensajeDenegar.texto)
    setMensajeDenegar({ open: false, solicitudId: null, texto: '' })
  }

  if (loading) return <><div className="text-center py-20 text-gray-400">Cargando...</div></>
  if (!materia) return <><div className="text-center py-20 text-gray-400">Materia no encontrada</div></>

  return (
    <>
      <PageHeader
        title={materia.nombre}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-bold text-blue-600">{materia.clave}</span>
            <span>🕐 {materia.horaInicio && materia.horaFin ? `${materia.horaInicio}–${materia.horaFin}` : 'Horario por asignar'}</span>
            <span>📅 {materia.dias || 'Días por asignar'}</span>
            <span>👥 {materia.inscripciones?.length} alumno(s)</span>
          </span>
        }
      />

      {/* Tabs */}
      <div className="mb-5 overflow-x-auto pb-1">
        <div className="flex w-max gap-1 rounded-xl bg-gray-100 p-1">
          {['unidades', 'alumnos', ...(solicitudes.length > 0 ? ['solicitudes'] : [])].map((tab) => (
            <button key={tab} onClick={() => setTabActivo(tab)}
              className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${tabActivo === tab ? 'bg-white text-gray-800 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab} {tab === 'solicitudes' && `(${solicitudes.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* UNIDADES */}
      {tabActivo === 'unidades' && (
        <div className="space-y-4">
          {materia.unidades?.map((u) => {
            const claseActiva = u.clases?.find((c) => c.status === 'ACTIVA')
            return (
              <div key={u.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-gray-800">Unidad {u.orden}: {u.nombre}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[u.status]}`}>{u.status}</span>
                  </div>
                  {esDocente && (
                    <div className="flex flex-wrap gap-2">
                      {u.status === 'PENDIENTE' && (
                        <button onClick={() => iniciarUnidad(u.id)}
                          className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition">
                          Iniciar unidad
                        </button>
                      )}
                      {u.status === 'ACTIVA' && (
                        <>
                          <button onClick={() => iniciarClase(u.id)}
                            className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                            + Clase
                          </button>
                          <button onClick={() => navigate(`/docente/tareas/crear?materiaId=${id}&unidadId=${u.id}`)}
                            className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition">
                            + Tarea
                          </button>
                          <button onClick={() => finalizarUnidad(u.id)}
                            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
                            Finalizar unidad
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {claseActiva && esDocente && (
                  <div className="mb-3 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-sm font-medium text-green-800">Clase en curso: {claseActiva.tema ?? 'Sin tema'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => abrirAsistencia(claseActiva.id)}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition">
                        Pasar lista
                      </button>
                      <button onClick={() => finalizarClase(claseActiva.id)}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                        Finalizar clase
                      </button>
                    </div>
                  </div>
                )}

                {u.clases?.filter((c) => c.status !== 'ACTIVA').length > 0 && (
                  <div className="mb-3 space-y-1">
                    {u.clases.filter((c) => c.status !== 'ACTIVA').map((c) => (
                      <div key={c.id} className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-gray-700">{c.tema ?? 'Clase'}</span>
                        <span className="text-gray-400 text-xs">{new Date(c.fecha).toLocaleDateString('es-MX')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {u.tareas?.length > 0 && (
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-xs text-gray-500 font-medium mb-1">Tareas ({u.tareas.length})</p>
                    {u.tareas.map((t) => (
                      <div key={t.id} className="flex flex-col gap-1 rounded-lg bg-yellow-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-gray-700">{t.titulo}</span>
                        <span className="text-xs text-orange-500">{t.tipoEntrega}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ALUMNOS */}
      {tabActivo === 'alumnos' && (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Alumno</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">N° Control</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {materia.inscripciones?.map((i) => (
                <tr key={i.alumno.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{i.alumno.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{i.alumno.numeroControl ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{i.alumno.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{i.alumno.telefono ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {materia.inscripciones?.length === 0 && (
            <p className="text-center text-gray-400 py-10">Sin alumnos inscritos</p>
          )}
        </div>
      )}

      {/* SOLICITUDES */}
      {tabActivo === 'solicitudes' && (
        <div className="space-y-3">
          {solicitudes.map((s) => (
            <div key={s.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-800">{s.alumno.nombre}</p>
                <p className="text-sm text-gray-500">{s.alumno.numeroControl} · {s.alumno.email}</p>
              </div>
              <div className="flex w-full flex-col gap-2 shrink-0 sm:w-auto sm:flex-row">
                <button onClick={() => responderSolicitud(s.id, true)}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700">
                  Aceptar
                </button>
                <button onClick={() => abrirDenegar(s.id)}
                  className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 transition hover:bg-red-100">
                  Denegar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Pasar lista */}
      <Modal open={modalAsistencia.open} onClose={() => setModalAsistencia({ open: false, claseId: null, alumnos: [] })} title="Pasar lista">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {modalAsistencia.alumnos.map((alumno) => (
            <div key={alumno.id} className="flex flex-col gap-2 border-b border-gray-50 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{alumno.nombre}</p>
                <p className="text-xs text-gray-400">{alumno.numeroControl}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {['PRESENTE', 'RETARDO', 'FALTA'].map((tipo) => (
                  <button key={tipo} onClick={() => setAsistencias((p) => ({ ...p, [alumno.id]: tipo }))}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${asistencias[alumno.id] === tipo
                      ? tipo === 'PRESENTE' ? 'bg-green-500 text-white'
                        : tipo === 'RETARDO' ? 'bg-yellow-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-500'}`}>
                    {tipo === 'PRESENTE' ? '✓' : tipo === 'RETARDO' ? 'R' : '✗'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={guardarAsistencia} className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition">
          Guardar asistencia
        </button>
      </Modal>

      {/* Modal: Denegar solicitud con mensaje */}
      <Modal open={mensajeDenegar.open} onClose={() => setMensajeDenegar({ open: false, solicitudId: null, texto: '' })} title="Denegar solicitud">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Puedes enviar un mensaje al alumno explicando el motivo.</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
            <textarea
              rows={3}
              value={mensajeDenegar.texto}
              onChange={(e) => setMensajeDenegar((p) => ({ ...p, texto: e.target.value }))}
              placeholder="Ej: El grupo ya está lleno, intenta el próximo semestre."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setMensajeDenegar({ open: false, solicitudId: null, texto: '' })}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarDenegar}
              className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition text-sm"
            >
              Denegar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Nueva tarea */}
      <Modal open={modalTarea.open} onClose={() => setModalTarea({ open: false, unidadId: null })} title="Nueva tarea">
        <form onSubmit={crearTarea} className="space-y-3">
          <input required value={tarea.titulo} onChange={(e) => setTarea({ ...tarea, titulo: e.target.value })}
            placeholder="Título de la tarea"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea rows={3} value={tarea.instrucciones} onChange={(e) => setTarea({ ...tarea, instrucciones: e.target.value })}
            placeholder="Instrucciones..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de entrega</label>
            <select value={tarea.tipoEntrega} onChange={(e) => setTarea({ ...tarea, tipoEntrega: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ONLINE">En línea (subir archivo)</option>
              <option value="PRESENCIAL">Presencial</option>
            </select>
          </div>
          {tarea.tipoEntrega === 'PRESENCIAL' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={tarea.requiereFirma} onChange={(e) => setTarea({ ...tarea, requiereFirma: e.target.checked })} />
              Requiere foto de firma
            </label>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha límite (opcional)</label>
            <input type="datetime-local" value={tarea.fechaLimite} onChange={(e) => setTarea({ ...tarea, fechaLimite: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition">
            Publicar tarea
          </button>
        </form>
      </Modal>
    </>
  )
}
