import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Plus, Search, Trash2, UserPlus, UsersRound } from 'lucide-react'
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

        <button
          type="button"
          onClick={() => setModalAgregar(true)}
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-strong sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Agregar grupo
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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

function TarjetaGrupo({ grupo, onVer, onAgregarAlumnos, onQuitar }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold text-primary">
            {grupo.nombre}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {grupo.carrera?.nombre ?? 'Sin carrera'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          Sem. {grupo.semestre}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {grupo.periodo}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {grupo._count?.alumnos ?? 0} alumnos
        </span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            grupo.agregado
              ? 'bg-muted text-muted-foreground'
              : 'bg-success/15 text-success'
          }`}
        >
          {grupo.agregado ? 'Agregado por ti' : 'De tu horario'}
        </span>
      </div>

      {grupo.materias?.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Le impartes{' '}
          <span className="text-foreground">
            {grupo.materias.map((materia) => materia.nombre).join(', ')}
          </span>
        </p>
      ) : (
        <p className="inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Sin clases programadas con este grupo.
          <Link
            to="/docente/horario/editar"
            className="font-medium text-primary hover:underline"
          >
            Programar una
          </Link>
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onAgregarAlumnos}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-strong"
        >
          <UserPlus className="h-4 w-4" />
          Agregar alumnos
        </button>
        <button
          type="button"
          onClick={onVer}
          className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Ver alumnos
        </button>
        {grupo.agregado && (
          <button
            type="button"
            onClick={onQuitar}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </button>
        )}
      </div>
    </div>
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
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, carrera o periodo..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={yaEsMio || agregando === grupo.id}
                    onClick={() => agregar(grupo)}
                    className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary-strong disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {yaEsMio
                      ? 'Ya es tuyo'
                      : agregando === grupo.id
                        ? 'Agregando...'
                        : 'Agregar'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function ModalDetalleGrupo({ grupo, onClose }) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    const cargarDetalle = async () => {
      setCargando(true)
      setError('')
      try {
        const { data } = await api.get(`/grupos/mis-grupos/${grupo.id}`)
        if (activo) setDetalle(data)
      } catch (err) {
        if (activo) {
          setError(err.response?.data?.message ?? 'No se pudo cargar el grupo')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargarDetalle()
    return () => {
      activo = false
    }
  }, [grupo])

  const alumnos = detalle?.alumnos ?? []

  return (
    <Modal open onClose={onClose} title={`Grupo ${grupo.nombre}`}>
      {cargando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando alumnos...
        </p>
      ) : error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {materia.nombre}
                </span>
              ))}
            </div>
          )}

          {alumnos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Este grupo todavía no tiene alumnos asignados.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {alumnos.map((alumno) => (
                <li key={alumno.id} className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground">
                    {alumno.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {alumno.numeroControl ?? 'Sin número de control'}
                    {alumno.email ? ` · ${alumno.email}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
