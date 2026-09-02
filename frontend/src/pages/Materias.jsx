import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CiCalendarDate, CiClock2, CiEdit, CiRead, CiTrash, CiUser } from 'react-icons/ci'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'

const FORM_VACIO = {
  nombre: '', clave: '', descripcion: '',
  numUnidades: 3, carreraId: '', semestre: '',
}

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : (message || fallback)
}

export default function Materias() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [materias, setMaterias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroCarrera, setFiltroCarrera] = useState('')
  const [filtroSemestre, setFiltroSemestre] = useState('')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState({ open: false, materia: null, loading: false, error: '' })

  const esAlumno = user?.rol === 'ALUMNO'
  const esAdmin = user?.rol === 'ADMIN'
  const canCreate = esAdmin || user?.rol === 'DOCENTE'

  const fetchMaterias = useCallback(() => {
    const endpoint = esAlumno ? '/materias/para-alumno' : user?.rol === 'DOCENTE' ? '/materias/mis-materias' : '/materias'
    return api.get(endpoint).then((r) => setMaterias(r.data))
  }, [esAlumno, user?.rol])

  useEffect(() => {
    fetchMaterias()
    api.get('/carreras').then((r) => setCarreras(r.data))
  }, [fetchMaterias])

  const abrirCreacion = () => {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError('')
    setModal(true)
  }

  const abrirEdicion = (materia) => {
    setEditandoId(materia.id)
    setForm({
      nombre: materia.nombre,
      clave: materia.clave,
      descripcion: materia.descripcion ?? '',
      numUnidades: materia.numUnidades ?? 3,
      carreraId: materia.carrera?.id ? String(materia.carrera.id) : '',
      semestre: materia.semestre ? String(materia.semestre) : '',
    })
    setError('')
    setModal(true)
  }

  const cerrarModal = () => {
    if (guardando) return
    setModal(false)
    setEditandoId(null)
    setError('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        clave: form.clave.trim().toUpperCase(),
        descripcion: form.descripcion.trim(),
        carreraId: form.carreraId ? parseInt(form.carreraId) : editandoId ? null : undefined,
        semestre: form.semestre ? parseInt(form.semestre) : editandoId ? null : undefined,
      }
      if (editandoId) {
        await api.patch(`/materias/${editandoId}`, payload)
      } else {
        await api.post('/materias', { ...payload, numUnidades: parseInt(form.numUnidades) })
      }
      setModal(false)
      setEditandoId(null)
      setForm(FORM_VACIO)
      await fetchMaterias()
    } catch (err) {
      setError(mensajeError(err, editandoId ? 'No se pudo editar la materia' : 'No se pudo crear la materia'))
    } finally {
      setGuardando(false)
    }
  }

  const pedirEliminar = (materia) => {
    setConfirmacion({ open: true, materia, loading: false, error: '' })
  }

  const cerrarConfirmacion = () => {
    if (confirmacion.loading) return
    setConfirmacion({ open: false, materia: null, loading: false, error: '' })
  }

  const eliminarMateria = async () => {
    const materia = confirmacion.materia
    if (!materia) return
    setConfirmacion((actual) => ({ ...actual, loading: true, error: '' }))
    try {
      await api.delete(`/materias/${materia.id}`)
      setConfirmacion({ open: false, materia: null, loading: false, error: '' })
      await fetchMaterias()
    } catch (err) {
      setConfirmacion((actual) => ({
        ...actual,
        loading: false,
        error: mensajeError(err, 'No se pudo eliminar la materia'),
      }))
    }
  }

  const materiasFiltradas = materias.filter((m) => {
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q || m.nombre.toLowerCase().includes(q) || m.clave.toLowerCase().includes(q)
    const matchCarrera = !filtroCarrera || m.carrera?.id === parseInt(filtroCarrera)
    const matchSemestre = !filtroSemestre || m.semestre === parseInt(filtroSemestre)
    return matchBusqueda && matchCarrera && matchSemestre
  })

  const hayFiltros = busqueda || filtroCarrera || filtroSemestre

  const MateriaCard = ({ m }) => (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex cursor-pointer flex-col gap-3 transition hover:shadow-md"
      onClick={() => navigate(esAlumno ? `/alumno/materias/${m.id}` : `/materias/${m.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{m.clave}</span>
          <h3 className="font-semibold text-gray-800 mt-1">{m.nombre}</h3>
        </div>
        <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs text-gray-400">{m._count?.inscripciones ?? 0} alumnos</span>
          {esAdmin && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                abrirEdicion(m)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              aria-label={`Editar ${m.nombre}`}
            >
              <CiEdit className="h-4 w-4" aria-hidden="true" />
              Editar
            </button>
          )}
          {esAdmin && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                pedirEliminar(m)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-background px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-400/40"
              aria-label={`Eliminar ${m.nombre}`}
            >
              <CiTrash className="h-4 w-4" aria-hidden="true" />
              Eliminar
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p className="flex items-center gap-2">
          <CiUser className="shrink-0" />
          <span>{m.docente?.nombre ? m.docente.nombre : 'Por asignar desde horarios'}</span>
        </p>
        <p className="flex items-center gap-2">
          <CiClock2 className="shrink-0" />
          <span>{m.horaInicio && m.horaFin ? `${m.horaInicio} – ${m.horaFin}` : 'Horario por asignar'}</span>
        </p>
        <p className="flex items-center gap-2">
          <CiCalendarDate className="shrink-0" />
          <span>{m.dias || 'Días por asignar'}</span>
        </p>
        {m.carrera && (
          <p className="flex items-center gap-2">
            <CiRead className="shrink-0" />
            <span>{m.carrera.nombre} {m.semestre ? `· Sem. ${m.semestre}` : ''}</span>
          </p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Materias"
        subtitle={esAlumno ? 'Materias disponibles para tu grupo, carrera o semestre' : 'Materias disponibles este semestre'}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canCreate && (
              <button
                onClick={abrirCreacion}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
              >
                + Nueva materia
              </button>
            )}
          </div>
        }
      />

      {/* Filtros — solo para admin/docente */}
      {!esAlumno && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="text"
            placeholder="Buscar por nombre o clave..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-60"
          />
          <select
            value={filtroCarrera}
            onChange={(e) => { setFiltroCarrera(e.target.value); setFiltroSemestre('') }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-60"
          >
            <option value="">Todas las carreras</option>
            {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select
            value={filtroSemestre}
            onChange={(e) => setFiltroSemestre(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-36"
          >
            <option value="">Todos los semestres</option>
            {[1,2,3,4,5,6,7,8].map((s) => (
              <option key={s} value={s}>Semestre {s}</option>
            ))}
          </select>
          {hayFiltros && (
            <button
              onClick={() => { setBusqueda(''); setFiltroCarrera(''); setFiltroSemestre('') }}
              className="text-sm text-gray-400 hover:text-gray-600 px-2 transition"
            >
              Limpiar
            </button>
          )}
          {hayFiltros && (
            <span className="text-sm text-gray-400 self-center">
              {materiasFiltradas.length} resultado{materiasFiltradas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {materiasFiltradas.map((m) => <MateriaCard key={m.id} m={m} />)}
        {materiasFiltradas.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            {esAlumno
              ? 'No hay materias disponibles para tu grupo, carrera o semestre.'
              : hayFiltros ? 'No hay materias que coincidan con los filtros.'
              : 'No hay materias registradas'}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={cerrarModal} title={editandoId ? 'Editar materia' : 'Nueva materia'}>
        <form onSubmit={guardar} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label htmlFor="materia-nombre" className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input id="materia-nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Cálculo Diferencial"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="materia-clave" className="block text-xs font-medium text-gray-700 mb-1">Clave *</label>
            <input id="materia-clave" required value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase() })}
              placeholder="RSB-2403"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label htmlFor="materia-descripcion" className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea id="materia-descripcion" rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Opcional"
              className="w-full resize-y border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Carrera y semestre */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="materia-carrera" className="block text-xs font-medium text-gray-700 mb-1">Carrera</label>
              <select id="materia-carrera" value={form.carreraId} onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas</option>
                {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="materia-semestre" className="block text-xs font-medium text-gray-700 mb-1">Semestre</label>
              <select id="materia-semestre" value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((s) => (
                  <option key={s} value={s}>{s}°</option>
                ))}
              </select>
            </div>
          </div>

          {!editandoId && (
            <div>
              <label htmlFor="materia-unidades" className="block text-xs font-medium text-gray-700 mb-1">Número de unidades</label>
              <input id="materia-unidades" type="number" min={1} max={10} required value={form.numUnidades}
                onChange={(e) => setForm({ ...form, numUnidades: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            El horario, docente, aula y grupo se asignan después desde el módulo <strong>Gestión de Horarios</strong>.
          </div>
          {error && <p role="alert" className="text-red-500 text-xs">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={guardando} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50">
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear materia'}
            </button>
            {editandoId && (
              <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </Modal>

      <Modal open={confirmacion.open} onClose={cerrarConfirmacion} title="Eliminar materia">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Se eliminará definitivamente <strong>{confirmacion.materia?.nombre}</strong> ({confirmacion.materia?.clave}). Esta acción no se puede deshacer.
          </p>
          <p className="text-sm text-gray-500">
            Se borran también sus unidades, horarios, sesiones de clase con sus asistencias, tareas con sus entregas, inscripciones y calificaciones. Los grupos y las academias se conservan, sólo dejan de tenerla asignada.
          </p>
          {confirmacion.error && <p role="alert" className="text-sm text-red-500">{confirmacion.error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cerrarConfirmacion}
              disabled={confirmacion.loading}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminarMateria}
              disabled={confirmacion.loading}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {confirmacion.loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
