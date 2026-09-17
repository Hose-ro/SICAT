import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays as CiCalendarDate, Clock as CiClock2, Pencil as CiEdit, BookOpen as CiRead, ListChecks as CiSelect, Trash2 as CiTrash, UserRound as CiUser } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'

const FORM_VACIO = {
  nombre: '', clave: '', descripcion: '',
  numUnidades: 3, carreraId: '', semestre: '',
}

const FORM_LOTE_VACIO = { carreraId: '', semestre: '' }
const LOTE_CERRADO = { tipo: null, loading: false, error: '' }

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : (message || fallback)
}

// '' = no tocar el campo, 'ninguno' = dejarlo vacío, otro valor = id/número.
function valorLote(valor) {
  if (valor === '') return undefined
  return valor === 'ninguno' ? null : parseInt(valor)
}

function resumirErrores(errores, materias) {
  if (!errores?.length) return ''
  const detalle = errores.map((e) => {
    const materia = materias.find((m) => m.id === e.id)
    return `${materia ? materia.nombre : `#${e.id}`}: ${e.motivo}`
  })
  return ` ${errores.length} no se pudieron procesar: ${detalle.join('; ')}.`
}

export default function Materias() {
  const { user } = useAuthStore()
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
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [lote, setLote] = useState(LOTE_CERRADO)
  const [formLote, setFormLote] = useState(FORM_LOTE_VACIO)
  const [aviso, setAviso] = useState('')

  const esAlumno = user?.rol === 'ALUMNO'
  const esAdmin = user?.rol === 'ADMIN'
  // Admin y docente crean, editan y eliminan; el backend limita al docente a
  // las materias que imparte.
  const canManage = esAdmin || user?.rol === 'DOCENTE'

  const fetchMaterias = useCallback(() => {
    const endpoint = esAlumno ? '/materias/para-alumno' : user?.rol === 'DOCENTE' ? '/materias/mis-materias' : '/materias'
    return api.get(endpoint).then((r) => setMaterias(r.data))
  }, [esAlumno, user?.rol])

  useEffect(() => {
    fetchMaterias()
    api.get('/carreras').then((r) => setCarreras(r.data))
  }, [fetchMaterias])

  const salirDeSeleccion = () => {
    setModoSeleccion(false)
    setSeleccionados([])
  }

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
      salirDeSeleccion()
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

  // La selección sólo cuenta lo que se ve: si un filtro oculta una materia
  // marcada, deja de participar en las acciones por lote.
  const seleccionActiva = seleccionados.filter((id) => materiasFiltradas.some((m) => m.id === id))
  const materiasSeleccionadas = materiasFiltradas.filter((m) => seleccionActiva.includes(m.id))
  const todosSeleccionados = materiasFiltradas.length > 0 && seleccionActiva.length === materiasFiltradas.length

  const alternarSeleccion = (id) => {
    setSeleccionados((actual) => (
      actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]
    ))
  }

  const alternarTodos = () => {
    setSeleccionados(todosSeleccionados ? [] : materiasFiltradas.map((m) => m.id))
  }

  const editarSeleccion = () => {
    if (materiasSeleccionadas.length === 1) {
      abrirEdicion(materiasSeleccionadas[0])
      return
    }
    setFormLote(FORM_LOTE_VACIO)
    setLote({ tipo: 'editar', loading: false, error: '' })
  }

  const cerrarLote = () => {
    if (lote.loading) return
    setLote(LOTE_CERRADO)
  }

  const guardarLote = async (e) => {
    e.preventDefault()
    const payload = {
      materiaIds: seleccionActiva,
      carreraId: valorLote(formLote.carreraId),
      semestre: valorLote(formLote.semestre),
    }
    if (payload.carreraId === undefined && payload.semestre === undefined) {
      setLote((actual) => ({ ...actual, error: 'Elige qué carrera o semestre asignar' }))
      return
    }
    setLote((actual) => ({ ...actual, loading: true, error: '' }))
    try {
      const { data } = await api.patch('/materias/lote', payload)
      setLote(LOTE_CERRADO)
      salirDeSeleccion()
      setAviso(`Se editaron ${data.actualizadas} de ${seleccionActiva.length} materia(s).${resumirErrores(data.errores, materias)}`)
      await fetchMaterias()
    } catch (err) {
      setLote((actual) => ({ ...actual, loading: false, error: mensajeError(err, 'No se pudo editar la selección') }))
    }
  }

  const eliminarLote = async () => {
    setLote((actual) => ({ ...actual, loading: true, error: '' }))
    try {
      const { data } = await api.delete('/materias/lote', { data: { materiaIds: seleccionActiva } })
      setLote(LOTE_CERRADO)
      salirDeSeleccion()
      setAviso(`Se eliminaron ${data.eliminadas} de ${seleccionActiva.length} materia(s).${resumirErrores(data.errores, materias)}`)
      await fetchMaterias()
    } catch (err) {
      setLote((actual) => ({ ...actual, loading: false, error: mensajeError(err, 'No se pudo eliminar la selección') }))
    }
  }

  // Se renderiza como función (no como componente) para que React no
  // desmonte las tarjetas en cada cambio de estado y se pierda el foco.
  const renderMateria = (m) => {
    const seleccionada = seleccionActiva.includes(m.id)
    const Contenedor = modoSeleccion ? 'label' : 'div'
    return (
    <Contenedor
      key={m.id}
      className={`bg-card rounded-2xl border shadow-sm p-5 flex cursor-pointer flex-col gap-3 transition hover:shadow-md ${
        seleccionada ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        {modoSeleccion && (
          <input
            type="checkbox"
            checked={seleccionada}
            onChange={() => alternarSeleccion(m.id)}
            aria-label={`Seleccionar ${m.nombre}`}
            className="mr-3 mt-1 h-4 w-4 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-primary-ink bg-accent px-2 py-0.5 rounded-lg">{m.clave}</span>
          <h2 className="font-semibold text-foreground mt-1">
            {modoSeleccion
              ? m.nombre
              : <Link className="hover:underline" to={esAlumno ? `/alumno/materias/${m.id}` : `/materias/${m.id}`}>{m.nombre}</Link>}
          </h2>
        </div>
        <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground">{m._count?.inscripciones ?? 0} alumnos</span>
          {canManage && !modoSeleccion && (
            <Button variant="outline"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                abrirEdicion(m)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 border border-input px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              aria-label={`Editar ${m.nombre}`}
            >
              <CiEdit className="h-4 w-4" aria-hidden="true" />
              Editar
            </Button>
          )}
          {canManage && !modoSeleccion && (
            <Button variant="destructive"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                pedirEliminar(m)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              aria-label={`Eliminar ${m.nombre}`}
            >
              <CiTrash className="h-4 w-4" aria-hidden="true" />
              Eliminar
            </Button>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
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
    </Contenedor>
    )
  }

  return (
    <>
      <PageHeader
        title="Materias"
        subtitle={esAlumno ? 'Materias disponibles para tu grupo, carrera o semestre' : 'Materias disponibles este semestre'}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canManage && !modoSeleccion && materias.length > 0 && (
              <Button variant="outline"
                onClick={() => setModoSeleccion(true)}
                className="w-full gap-1.5 border px-4 py-2 text-sm font-medium sm:w-auto"
              >
                <CiSelect className="h-4 w-4" aria-hidden="true" />
                Seleccionar
              </Button>
            )}
            {canManage && (
              <Button variant="default"
                onClick={abrirCreacion}
                className="w-full px-4 py-2 text-sm font-medium sm:w-auto"
              >
                + Nueva materia
              </Button>
            )}
          </div>
        }
      />

      {aviso && (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground">
          <span>{aviso}</span>
          <Button variant="ghost" onClick={() => setAviso('')} className="text-success-foreground hover:text-success-foreground" aria-label="Cerrar aviso">✕</Button>
        </div>
      )}

      {/* Filtros — solo para admin/docente */}
      {!esAlumno && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input aria-label="Buscar por nombre o clave"
            type="text"
            placeholder="Buscar por nombre o clave..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-60"
          />
          <select aria-label="Carrera"
            value={filtroCarrera}
            onChange={(e) => { setFiltroCarrera(e.target.value); setFiltroSemestre('') }}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-60"
          >
            <option value="">Todas las carreras</option>
            {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select aria-label="Semestre"
            value={filtroSemestre}
            onChange={(e) => setFiltroSemestre(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-36"
          >
            <option value="">Todos los semestres</option>
            {[1,2,3,4,5,6,7,8].map((s) => (
              <option key={s} value={s}>Semestre {s}</option>
            ))}
          </select>
          {hayFiltros && (
            <Button variant="ghost"
              onClick={() => { setBusqueda(''); setFiltroCarrera(''); setFiltroSemestre('') }}
              className="text-sm text-muted-foreground hover:text-muted-foreground px-2"
            >
              Limpiar
            </Button>
          )}
          {hayFiltros && (
            <span className="text-sm text-muted-foreground self-center">
              {materiasFiltradas.length} resultado{materiasFiltradas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {modoSeleccion && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={todosSeleccionados}
              onChange={alternarTodos}
              aria-label="Seleccionar todas las materias visibles"
              className="h-4 w-4"
            />
            Seleccionar todas
          </label>
          <span className="text-sm text-muted-foreground">
            {seleccionActiva.length} de {materiasFiltradas.length} seleccionada{seleccionActiva.length !== 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline"
              type="button"
              onClick={editarSeleccion}
              disabled={seleccionActiva.length === 0}
              className="gap-1.5 border px-3 py-1.5 text-sm disabled:cursor-not-allowed"
            >
              <CiEdit className="h-4 w-4" aria-hidden="true" />
              Editar{seleccionActiva.length > 0 ? ` (${seleccionActiva.length})` : ''}
            </Button>
            <Button variant="destructive"
              type="button"
              onClick={() => setLote({ tipo: 'eliminar', loading: false, error: '' })}
              disabled={seleccionActiva.length === 0}
              className="gap-1.5 px-3 py-1.5 text-sm disabled:cursor-not-allowed"
            >
              <CiTrash className="h-4 w-4" aria-hidden="true" />
              Eliminar{seleccionActiva.length > 0 ? ` (${seleccionActiva.length})` : ''}
            </Button>
            <Button variant="ghost" type="button" onClick={salirDeSeleccion} className="px-3 py-1.5 text-sm">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {materiasFiltradas.map(renderMateria)}
        {materiasFiltradas.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
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
            <label htmlFor="materia-nombre" className="block text-xs font-medium text-foreground mb-1">Nombre *</label>
            <input id="materia-nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Cálculo Diferencial"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="materia-clave" className="block text-xs font-medium text-foreground mb-1">Clave *</label>
            <input id="materia-clave" required value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase() })}
              placeholder="RSB-2403"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div>
            <label htmlFor="materia-descripcion" className="block text-xs font-medium text-foreground mb-1">Descripción</label>
            <textarea id="materia-descripcion" rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Opcional"
              className="w-full resize-y border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          {/* Carrera y semestre */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="materia-carrera" className="block text-xs font-medium text-foreground mb-1">Carrera</label>
              <select id="materia-carrera" value={form.carreraId} onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Todas</option>
                {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="materia-semestre" className="block text-xs font-medium text-foreground mb-1">Semestre</label>
              <select id="materia-semestre" value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Todos</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((s) => (
                  <option key={s} value={s}>{s}°</option>
                ))}
              </select>
            </div>
          </div>

          {!editandoId && (
            <div>
              <label htmlFor="materia-unidades" className="block text-xs font-medium text-foreground mb-1">Número de unidades</label>
              <input id="materia-unidades" type="number" min={1} max={10} required value={form.numUnidades}
                onChange={(e) => setForm({ ...form, numUnidades: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          )}
          <div className="rounded-xl border border-border bg-accent px-3 py-2 text-xs text-primary-ink">
            El horario, docente, aula y grupo se asignan después desde el módulo <strong>Gestión de Horarios</strong>.
          </div>
          {error && <p role="alert" className="text-destructive-foreground text-xs">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="default" type="submit" disabled={guardando} className="flex-1 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50">
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear materia'}
            </Button>
            {editandoId && (
              <Button variant="outline" type="button" onClick={cerrarModal} disabled={guardando} className="border px-4 py-2.5 text-sm font-medium disabled:opacity-50">
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Modal open={confirmacion.open} onClose={cerrarConfirmacion} title="Eliminar materia">
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Se eliminará definitivamente <strong>{confirmacion.materia?.nombre}</strong> ({confirmacion.materia?.clave}). Esta acción no se puede deshacer.
          </p>
          <p className="text-sm text-muted-foreground">
            Se borran también sus unidades, horarios, sesiones de clase con sus asistencias, tareas con sus entregas, inscripciones y calificaciones. Los grupos y las academias se conservan, sólo dejan de tenerla asignada.
          </p>
          {confirmacion.error && <p role="alert" className="text-sm text-destructive-foreground">{confirmacion.error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline"
              type="button"
              onClick={cerrarConfirmacion}
              disabled={confirmacion.loading}
              className="border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </Button>
            <Button variant="destructive"
              type="button"
              onClick={eliminarMateria}
              disabled={confirmacion.loading}
              className="px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {confirmacion.loading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={lote.tipo === 'editar'} onClose={cerrarLote} busy={lote.loading} title={`Editar ${materiasSeleccionadas.length} materias`}
        description="Nombre, clave y descripción son propios de cada materia; aquí sólo se cambia lo que comparten.">
        <form onSubmit={guardarLote} className="space-y-3">
          <ul className="max-h-32 overflow-y-auto rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {materiasSeleccionadas.map((m) => (
              <li key={m.id} className="truncate"><span className="font-semibold text-foreground">{m.clave}</span> · {m.nombre}</li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lote-carrera" className="block text-xs font-medium text-foreground mb-1">Carrera</label>
              <select id="lote-carrera" value={formLote.carreraId} onChange={(e) => setFormLote({ ...formLote, carreraId: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Sin cambios</option>
                <option value="ninguno">Todas (sin carrera)</option>
                {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lote-semestre" className="block text-xs font-medium text-foreground mb-1">Semestre</label>
              <select id="lote-semestre" value={formLote.semestre} onChange={(e) => setFormLote({ ...formLote, semestre: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Sin cambios</option>
                <option value="ninguno">Todos (sin semestre)</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((s) => (
                  <option key={s} value={s}>{s}°</option>
                ))}
              </select>
            </div>
          </div>
          {lote.error && <p role="alert" className="text-destructive-foreground text-xs">{lote.error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="default" type="submit" disabled={lote.loading} className="flex-1 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50">
              {lote.loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button variant="outline" type="button" onClick={cerrarLote} disabled={lote.loading} className="border px-4 py-2.5 text-sm font-medium disabled:opacity-50">
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={lote.tipo === 'eliminar'} onClose={cerrarLote} busy={lote.loading} title={`Eliminar ${materiasSeleccionadas.length} materia${materiasSeleccionadas.length !== 1 ? 's' : ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Se eliminarán definitivamente las materias seleccionadas. Esta acción no se puede deshacer.
          </p>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {materiasSeleccionadas.map((m) => (
              <li key={m.id} className="truncate"><span className="font-semibold text-foreground">{m.clave}</span> · {m.nombre}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            De cada una se borran también sus unidades, horarios, sesiones de clase con sus asistencias, tareas con sus entregas, inscripciones y calificaciones. Los grupos y las academias se conservan, sólo dejan de tenerla asignada.
          </p>
          {lote.error && <p role="alert" className="text-sm text-destructive-foreground">{lote.error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" type="button" onClick={cerrarLote} disabled={lote.loading} className="border px-4 py-2.5 text-sm font-medium disabled:opacity-50">
              Cancelar
            </Button>
            <Button variant="destructive" type="button" onClick={eliminarLote} disabled={lote.loading} className="px-4 py-2.5 text-sm font-medium disabled:opacity-50">
              {lote.loading ? 'Eliminando...' : `Eliminar ${materiasSeleccionadas.length}`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
