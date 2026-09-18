import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarClock,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import api from '../../api/axios'
import Modal from '../../components/Modal'
import AgregarAlumnosGrupoModal from './components/AgregarAlumnosGrupoModal'

function textoDeGrupo(grupo) {
  return [
    grupo.nombre,
    grupo.carrera?.nombre,
    grupo.carrera?.codigo,
    grupo.periodo,
    `semestre ${grupo.semestre}`,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export default function MisGrupos() {
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAgregar, setModalAgregar] = useState(false)
  const [grupoDetalle, setGrupoDetalle] = useState(null)
  const [grupoAlumnos, setGrupoAlumnos] = useState(null)
  const [grupoMaterias, setGrupoMaterias] = useState(null)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/grupos/mis-grupos')
      setGrupos(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudieron cargar tus grupos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const alumnosAgregados = async (mensaje) => {
    setGrupoAlumnos(null)
    setAviso(mensaje)
    await cargar()
  }

  const quitar = async (grupo) => {
    setError('')
    try {
      await api.delete(`/grupos/mis-grupos/${grupo.id}`)
      setGrupos((actuales) => actuales.filter((g) => g.id !== grupo.id))
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo quitar el grupo')
    }
  }

  const totalAlumnos = grupos.reduce(
    (acc, grupo) => acc + (grupo._count?.alumnos ?? 0),
    0,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
            <UsersRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              Mis grupos
            </h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? 'Cargando...'
                : `${grupos.length} grupo${grupos.length === 1 ? '' : 's'} · ${totalAlumnos} alumno${totalAlumnos === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <Button variant="default"
          type="button"
          onClick={() => setModalAgregar(true)}
          className="inline-flex items-center gap-2 self-start px-4 py-2 text-sm font-medium shadow-sm sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Agregar grupo
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {aviso && (
        <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
          {aviso}
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Cargando tus grupos...
        </p>
      ) : grupos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Todavía no tienes grupos
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Aquí aparecen los grupos de las clases que tienes programadas. Si el
            tuyo ya existe en el sistema, agrégalo con el botón de arriba.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((grupo) => (
            <TarjetaGrupo
              key={grupo.id}
              grupo={grupo}
              onVer={() => setGrupoDetalle(grupo)}
              onVerMaterias={() => setGrupoMaterias(grupo)}
              onAgregarAlumnos={() => {
                setAviso('')
                setGrupoAlumnos(grupo)
              }}
              onQuitar={() => quitar(grupo)}
            />
          ))}
        </div>
      )}

      <ModalAgregarGrupo
        open={modalAgregar}
        misGrupos={grupos}
        onClose={() => setModalAgregar(false)}
        onAgregado={(grupo) =>
          setGrupos((actuales) =>
            [...actuales, grupo].sort(
              (a, b) =>
                a.semestre - b.semestre || a.nombre.localeCompare(b.nombre),
            ),
          )
        }
      />

      {grupoDetalle && (
        <ModalDetalleGrupo
          grupo={grupoDetalle}
          onClose={() => setGrupoDetalle(null)}
        />
      )}

      {grupoMaterias && (
        <ModalMateriasGrupo
          grupo={grupoMaterias}
          onClose={() => setGrupoMaterias(null)}
        />
      )}

      {grupoAlumnos && (
        <AgregarAlumnosGrupoModal
          grupo={grupoAlumnos}
          onClose={() => setGrupoAlumnos(null)}
          onListo={alumnosAgregados}
        />
      )}
    </div>
  )
}

function TarjetaGrupo({
  grupo,
  onVer,
  onVerMaterias,
  onAgregarAlumnos,
  onQuitar,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold text-primary-ink">
            {grupo.nombre}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {grupo.carrera?.nombre ?? 'Sin carrera'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-ink">
          Sem. {grupo.semestre}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {grupo.periodo}
        </span>
        {grupo.modalidad === 'MIXTO' && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary-ink">
            Mixto
          </span>
        )}
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {grupo._count?.alumnos ?? 0} alumnos
        </span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            grupo.agregado
              ? 'bg-muted text-muted-foreground'
              : "bg-success/15 text-success-foreground"
          }`}
        >
          {grupo.agregado ? 'Agregado por ti' : 'De tu horario'}
        </span>
      </div>

      {grupo.materias?.length > 0 ? (
        <Button variant="ghost" size="row"
          type="button"
          onClick={onVerMaterias}
          className="w-auto max-w-full rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Le impartes{' '}
          <span className="font-medium text-foreground underline decoration-dotted underline-offset-4">
            {grupo.materias.length === 1
              ? grupo.materias[0].nombre
              : `${grupo.materias.length} materias`}
          </span>
        </Button>
      ) : (
        <p className="inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Sin clases programadas con este grupo.
          <Link
            to="/docente/horario/editar"
            className="font-medium text-primary-ink hover:underline"
          >
            Programar una
          </Link>
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button variant="default"
          type="button"
          onClick={onAgregarAlumnos}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
        >
          <UserPlus className="h-4 w-4" />
          Agregar alumnos
        </Button>
        <Button variant="outline"
          type="button"
          onClick={onVer}
          className="inline-flex items-center border px-3 py-2 text-sm font-medium"
        >
          Ver alumnos
        </Button>
        {grupo.materias?.length > 0 && (
          <Button variant="outline"
            type="button"
            onClick={onVerMaterias}
            className="inline-flex items-center gap-1.5 border px-3 py-2 text-sm font-medium"
          >
            <BookOpen className="h-4 w-4" />
            Ver materias
          </Button>
        )}
        {grupo.agregado && (
          <Button variant="destructive"
            type="button"
            onClick={onQuitar}
            className="inline-flex items-center gap-1.5 border px-3 py-2 text-sm font-medium"
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </Button>
        )}
      </div>
    </div>
  )
}

const DIAS_ORDEN = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
]

function ordenarDias(dias) {
  return (dias || '')
    .split(',')
    .map((dia) => dia.trim())
    .filter(Boolean)
    .sort(
      (a, b) =>
        DIAS_ORDEN.indexOf(
          a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
        ) -
        DIAS_ORDEN.indexOf(
          b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
        ),
    )
    .join(', ')
}

/** Materias que el docente le imparte al grupo, con sus bloques de horario. */
function ModalMateriasGrupo({ grupo, onClose }) {
  const materias = grupo.materias ?? []

  return (
    <Modal open onClose={onClose} title={`Materias de ${grupo.nombre}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {materias.length} materia{materias.length === 1 ? '' : 's'} ·{' '}
          {grupo.carrera?.nombre ?? 'Sin carrera'} · Sem. {grupo.semestre}
        </p>

        {materias.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tienes clases programadas con este grupo.
          </p>
        ) : (
          <ul className="space-y-3">
            {materias.map((materia) => (
              <li
                key={materia.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {materia.nombre}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {materia.clave ?? 'Sin clave'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      materia.unidadActiva
                        ? "bg-success/15 text-success-foreground"
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {materia.unidadActiva
                      ? materia.unidadActiva.nombre
                      : 'Sin unidad activa'}
                  </span>
                </div>

                {materia.horarios?.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3">
                    {materia.horarios.map((bloque, i) => (
                      <li
                        key={`${materia.id}-${i}`}
                        className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"
                      >
                        <CalendarClock className="h-4 w-4 shrink-0" />
                        <span className="capitalize text-foreground">
                          {ordenarDias(bloque.dias)}
                        </span>
                        <span>
                          {bloque.horaInicio} - {bloque.horaFin}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{bloque.aula?.nombre ?? 'Aula pendiente'}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  to={`/materias/${materia.id}`}
                  className="mt-3 inline-flex text-sm font-medium text-primary-ink hover:underline"
                >
                  Abrir materia
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function ModalAgregarGrupo({ open, misGrupos, onClose, onAgregado }) {
  const [catalogo, setCatalogo] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)
  const [agregando, setAgregando] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let activo = true
    setCargando(true)
    setBusqueda('')
    setError('')
    api
      .get('/grupos/catalogo')
      .then((res) => {
        if (activo) setCatalogo(res.data)
      })
      .catch((err) => {
        if (activo) {
          setError(
            err.response?.data?.message ?? 'No se pudo cargar el catálogo',
          )
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [open])

  const idsPropios = useMemo(
    () => new Set(misGrupos.map((grupo) => grupo.id)),
    [misGrupos],
  )

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return catalogo
    return catalogo.filter((grupo) => textoDeGrupo(grupo).includes(texto))
  }, [busqueda, catalogo])

  const agregar = async (grupo) => {
    setAgregando(grupo.id)
    setError('')
    try {
      const { data } = await api.post('/grupos/mis-grupos', {
        grupoId: grupo.id,
      })
      onAgregado(data)
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo agregar el grupo')
    } finally {
      setAgregando(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar un grupo existente">
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Buscar por nombre, carrera o periodo"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, carrera o periodo..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </p>
        )}

        {cargando ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Cargando grupos...
          </p>
        ) : resultados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {catalogo.length === 0
              ? 'No hay grupos registrados en el sistema.'
              : 'Ningún grupo coincide con tu búsqueda.'}
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {resultados.map((grupo) => {
              const yaEsMio = idsPropios.has(grupo.id)
              return (
                <li
                  key={grupo.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {grupo.nombre}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {grupo.carrera?.nombre ?? 'Sin carrera'} · Sem.{' '}
                      {grupo.semestre} · {grupo.periodo}
                      {grupo.modalidad === 'MIXTO' && ' · Mixto'}
                    </p>
                  </div>
                  <Button variant="default"
                    type="button"
                    disabled={yaEsMio || agregando === grupo.id}
                    onClick={() => agregar(grupo)}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium disabled:cursor-default"
                  >
                    {yaEsMio
                      ? 'Ya es tuyo'
                      : agregando === grupo.id
                        ? 'Agregando...'
                        : 'Agregar'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}

const FORM_EDITAR_ALUMNO = {
  nombre: '',
  numeroControl: '',
  email: '',
  telefono: '',
  password: '',
}

function ModalDetalleGrupo({ grupo, onClose }) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [alumnoEditar, setAlumnoEditar] = useState(null)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccion, setSeleccion] = useState([])
  const [quitando, setQuitando] = useState(false)

  const cargarDetalle = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get(`/grupos/mis-grupos/${grupo.id}`)
      setDetalle(data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el grupo'))
    } finally {
      setCargando(false)
    }
  }, [grupo.id])

  useEffect(() => {
    cargarDetalle()
  }, [cargarDetalle])

  const alumnos = detalle?.alumnos ?? []

  const todosSeleccionados =
    alumnos.length > 0 && seleccion.length === alumnos.length

  const alternarSeleccion = (alumnoId) => {
    setSeleccion((actual) =>
      actual.includes(alumnoId)
        ? actual.filter((id) => id !== alumnoId)
        : [...actual, alumnoId],
    )
  }

  const alternarTodos = () => {
    setSeleccion(todosSeleccionados ? [] : alumnos.map((alumno) => alumno.id))
  }

  const salirDeSeleccion = () => {
    setModoSeleccion(false)
    setSeleccion([])
  }

  const quitarAlumno = useAsyncAction(async (alumno) => {
    if (!(await confirmAction(`¿Quitar a ${alumno.nombre} de este grupo?`))) return
    setError('')
    try {
      await api.delete(`/grupos/mis-grupos/${grupo.id}/alumnos/${alumno.id}`)
      setAviso(`${alumno.nombre} salió del grupo.`)
      await cargarDetalle()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo quitar al alumno'))
    }
  })

  const quitarSeleccionados = useAsyncAction(async () => {
    if (seleccion.length === 0) return
    const total = seleccion.length
    const confirmacion = todosSeleccionados
      ? `¿Quitar del grupo a los ${total} alumnos? Sus cuentas se conservan: sólo dejan de pertenecer al grupo.`
      : `¿Quitar del grupo a ${total} alumno${total === 1 ? '' : 's'}? Sus cuentas se conservan: sólo dejan de pertenecer al grupo.`
    if (!(await confirmAction(confirmacion))) return

    setQuitando(true)
    setError('')
    try {
      const { data } = await api.delete(
        `/grupos/mis-grupos/${grupo.id}/alumnos`,
        { data: { alumnoIds: seleccion } },
      )
      const quitados = data?.quitados ?? total
      setAviso(
        quitados === 1
          ? '1 alumno salió del grupo.'
          : `${quitados} alumnos salieron del grupo.`,
      )
      salirDeSeleccion()
      await cargarDetalle()
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron quitar los alumnos'))
    } finally {
      setQuitando(false)
    }
  })

  return (
    <Modal open onClose={onClose} title={`Grupo ${grupo.nombre}`}>
      {cargando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando alumnos...
        </p>
      ) : error && !detalle ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {detalle?.carrera?.nombre ?? 'Sin carrera'} · Sem.{' '}
            {detalle?.semestre} · {detalle?.periodo}
          </p>

          {detalle?.materias?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detalle.materias.map((materia) => (
                <span
                  key={materia.id}
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-ink"
                >
                  {materia.nombre}
                </span>
              ))}
            </div>
          )}

          {aviso && (
            <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground">
              {aviso}
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </p>
          )}

          {alumnos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Este grupo todavía no tiene alumnos asignados.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {modoSeleccion
                    ? `${seleccion.length} de ${alumnos.length} seleccionado${seleccion.length === 1 ? '' : 's'}`
                    : `${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {modoSeleccion && (
                    <Button variant="outline"
                      type="button"
                      onClick={alternarTodos}
                      className="border px-2.5 py-1.5 text-xs font-medium"
                    >
                      {todosSeleccionados ? 'Quitar selección' : 'Seleccionar todos'}
                    </Button>
                  )}
                  <Button variant="outline"
                    type="button"
                    onClick={() =>
                      modoSeleccion ? salirDeSeleccion() : setModoSeleccion(true)
                    }
                    className="border px-2.5 py-1.5 text-xs font-medium"
                  >
                    {modoSeleccion ? 'Cancelar' : 'Seleccionar'}
                  </Button>
                </div>
              </div>

              <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {alumnos.map((alumno) => {
                  const datosIncompletos = !alumno.numeroControl
                  const marcado = seleccion.includes(alumno.id)
                  return (
                    <li
                      key={alumno.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2 ${
                        modoSeleccion ? 'cursor-pointer' : ''
                      } ${marcado ? 'bg-primary/10' : ''}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {modoSeleccion && (
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarSeleccion(alumno.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Seleccionar a ${alumno.nombre}`}
                            className="size-4 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {alumno.nombre}
                            {datosIncompletos && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                                Datos incompletos
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {alumno.numeroControl ?? 'Sin número de control'}
                            {alumno.email ? ` · ${alumno.email}` : ''}
                          </p>
                        </div>
                      </div>
                      {!modoSeleccion && (
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline"
                            type="button"
                            onClick={() => setAlumnoEditar(alumno)}
                            className="border px-2.5 py-1.5 text-xs font-medium"
                          >
                            {datosIncompletos ? 'Completar datos' : 'Editar'}
                          </Button>
                          <Button variant="destructive"
                            type="button"
                            onClick={() => quitarAlumno(alumno)}
                            className="border px-2.5 py-1.5 text-xs font-medium"
                          >
                            Quitar
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              {modoSeleccion && (
                <Button variant="destructive"
                  type="button"
                  onClick={quitarSeleccionados}
                  disabled={seleccion.length === 0 || quitando}
                  className="w-full py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {quitando
                    ? 'Quitando...'
                    : `Quitar del grupo ${seleccion.length || ''}`.trim()}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {alumnoEditar && (
        <ModalEditarAlumnoGrupo
          grupo={grupo}
          alumno={alumnoEditar}
          onClose={() => setAlumnoEditar(null)}
          onGuardado={async (mensaje) => {
            setAlumnoEditar(null)
            setAviso(mensaje)
            await cargarDetalle()
          }}
        />
      )}
    </Modal>
  )
}

function ModalEditarAlumnoGrupo({ grupo, alumno, onClose, onGuardado }) {
  const [form, setForm] = useState({
    nombre: alumno.nombre || '',
    numeroControl: alumno.numeroControl || '',
    email: alumno.email || '',
    telefono: alumno.telefono || '',
    password: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cerrar = () => {
    if (guardando) return
    onClose()
  }

  const guardar = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const payload = {}
      const nombre = form.nombre.trim()
      if (nombre && nombre !== alumno.nombre) payload.nombre = nombre
      if (form.numeroControl.trim()) payload.numeroControl = form.numeroControl.trim().toUpperCase()
      if (form.email.trim()) payload.email = form.email.trim()
      if (form.telefono.trim()) payload.telefono = form.telefono.trim()
      if (form.password.trim()) payload.password = form.password.trim()

      await api.patch(`/grupos/mis-grupos/${grupo.id}/alumnos/${alumno.id}`, payload)
      await onGuardado(`Datos de ${nombre || alumno.nombre} actualizados.`)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar al alumno'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal open onClose={cerrar} title={`Editar alumno — ${alumno.nombre}`}>
      <form onSubmit={guardar} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {alumno.numeroControl
            ? 'Corrige los datos del alumno. Deja la contraseña vacía si no quieres cambiarla.'
            : 'Este alumno se dio de alta sólo con su nombre. Agrega lo que tengas a la mano; puedes completar el resto más tarde.'}
        </p>
        {[
          { campo: 'nombre', etiqueta: 'Nombre completo', tipo: 'text' },
          { campo: 'numeroControl', etiqueta: 'Número de control', tipo: 'text', placeholder: '225Q0103' },
          { campo: 'email', etiqueta: 'Correo', tipo: 'email' },
          { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'text', placeholder: '9611234567' },
          { campo: 'password', etiqueta: 'Contraseña (déjalo vacío para no cambiarla)', tipo: 'password' },
        ].map((campo) => (
          <div key={campo.campo}>
            <label
              htmlFor={`editar-alumno-grupo-${campo.campo}`}
              className="mb-1 block text-xs font-medium text-foreground"
            >
              {campo.etiqueta}
            </label>
            <input
              id={`editar-alumno-grupo-${campo.campo}`}
              type={campo.tipo}
              minLength={campo.campo === 'password' ? 8 : undefined}
              placeholder={campo.placeholder}
              value={form[campo.campo]}
              onChange={(event) => setForm({ ...form, [campo.campo]: event.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        ))}
        {!form.numeroControl && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            Sin número de control, correo o contraseña real el alumno no podrá iniciar sesión todavía.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive-foreground">
            {error}
          </p>
        )}
        <Button variant="default"
          type="submit"
          disabled={guardando}
          className="w-full py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar datos'}
        </Button>
      </form>
    </Modal>
  )
}
