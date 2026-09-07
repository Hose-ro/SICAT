import { useEffect, useRef, useState } from 'react'
import Modal from '../../../components/Modal'
import api from '../../../api/axios'
import {
  FILA_ALUMNO_VACIA,
  leerListaDeArchivo,
} from '../../../lib/listaAlumnosArchivo'

const FORM_NUEVO = {
  nombre: '',
  numeroControl: '',
  password: '',
  email: '',
  telefono: '',
}

const PESTANAS = [
  { clave: 'existente', etiqueta: 'Buscar existente' },
  { clave: 'nuevo', etiqueta: 'Crear uno nuevo' },
  { clave: 'importar', etiqueta: 'Importar lista (Excel)' },
]

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}

/**
 * Las mismas tres formas de dar de alta alumnos que ya existen en el padrón de
 * una materia, pero apuntando al grupo: aquí el alumno queda asignado al grupo
 * del docente, no inscrito a una materia.
 */
export default function AgregarAlumnosGrupoModal({ grupo, onClose, onListo }) {
  const [pestana, setPestana] = useState('existente')
  const [busqueda, setBusqueda] = useState('')
  const [disponibles, setDisponibles] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [form, setForm] = useState(FORM_NUEVO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef(null)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [filasImportar, setFilasImportar] = useState([])
  const [resumenImportacion, setResumenImportacion] = useState(null)

  useEffect(() => {
    if (pestana !== 'existente') return undefined
    let activo = true
    const temporizador = setTimeout(() => {
      api
        .get(`/grupos/mis-grupos/${grupo.id}/alumnos-disponibles`, {
          params: busqueda.trim() ? { q: busqueda.trim() } : undefined,
        })
        .then((res) => {
          if (activo) setDisponibles(res.data)
        })
        .catch(() => {
          if (activo) setDisponibles([])
        })
    }, 250)
    return () => {
      activo = false
      clearTimeout(temporizador)
    }
  }, [pestana, busqueda, grupo.id])

  const cerrar = () => {
    if (guardando) return
    onClose()
  }

  const alternar = (id) => {
    setSeleccion((actual) =>
      actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id],
    )
  }

  const agregarExistentes = async () => {
    if (!seleccion.length) return
    setGuardando(true)
    setError('')
    try {
      await api.post(`/grupos/mis-grupos/${grupo.id}/alumnos`, {
        alumnoIds: seleccion,
      })
      await onListo(
        `${seleccion.length} alumno${seleccion.length === 1 ? '' : 's'} agregado${seleccion.length === 1 ? '' : 's'} a ${grupo.nombre}.`,
      )
    } catch (err) {
      setError(mensajeError(err, 'No se pudo agregar a los alumnos'))
    } finally {
      setGuardando(false)
    }
  }

  const crearAlumno = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await api.post(`/grupos/mis-grupos/${grupo.id}/alumnos/nuevo`, {
        nombre: form.nombre.trim(),
        numeroControl: form.numeroControl.trim().toUpperCase(),
        password: form.password,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
      })
      await onListo(`${form.nombre.trim()} quedó dado de alta en ${grupo.nombre}.`)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear al alumno'))
    } finally {
      setGuardando(false)
    }
  }

  const manejarArchivo = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setResumenImportacion(null)
    try {
      const filas = await leerListaDeArchivo(file)
      if (filas.length === 0) {
        setError('No se encontraron filas con datos en ese archivo.')
        setFilasImportar([])
      } else {
        setArchivoNombre(file.name)
        setFilasImportar(filas.slice(0, 300))
      }
    } catch {
      setError('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx/.xls) o CSV válido.')
      setFilasImportar([])
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const actualizarFilaImportar = (indice, campo, valor) => {
    setFilasImportar((actual) =>
      actual.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)),
    )
  }

  const quitarFilaImportar = (indice) => {
    setFilasImportar((actual) => actual.filter((_, i) => i !== indice))
  }

  const agregarFilaImportar = () => {
    setFilasImportar((actual) => [...actual, { ...FILA_ALUMNO_VACIA }])
  }

  const confirmarImportacion = async () => {
    const validas = filasImportar
      .map((fila) => ({
        nombre: fila.nombre.trim(),
        numeroControl: fila.numeroControl.trim(),
        email: fila.email.trim(),
        telefono: fila.telefono.trim(),
      }))
      .filter((fila) => fila.nombre)

    if (validas.length === 0) {
      setError('Agrega al menos un alumno con nombre antes de importar.')
      return
    }

    setGuardando(true)
    setError('')
    try {
      const { data } = await api.post(
        `/grupos/mis-grupos/${grupo.id}/alumnos/importar`,
        {
          alumnos: validas.map(({ nombre, numeroControl, email, telefono }) => ({
            nombre,
            ...(numeroControl ? { numeroControl: numeroControl.toUpperCase() } : {}),
            ...(email ? { email } : {}),
            ...(telefono ? { telefono } : {}),
          })),
        },
      )
      setResumenImportacion(data)
      setFilasImportar([])
      setArchivoNombre('')
    } catch (err) {
      setError(mensajeError(err, 'No se pudo importar la lista'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onClose={cerrar}
      title={`Agregar alumnos a ${grupo.nombre}`}
      wide={pestana === 'importar'}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PESTANAS.map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              onClick={() => {
                setPestana(opcion.clave)
                setError('')
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                pestana === opcion.clave
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {grupo.carrera?.nombre ?? 'Sin carrera'} · Sem. {grupo.semestre} ·{' '}
          {grupo.periodo}
        </p>

        {pestana === 'existente' && (
          <div className="space-y-3">
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre o número de control"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {disponibles.map((alumno) => {
                const enOtroGrupo = Boolean(alumno.grupo)
                return (
                  <label
                    key={alumno.id}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                      enOtroGrupo ? 'opacity-60' : 'cursor-pointer hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={enOtroGrupo}
                      checked={seleccion.includes(alumno.id)}
                      onChange={() => alternar(alumno.id)}
                    />
                    <span className="text-sm text-foreground">
                      {alumno.nombre}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {alumno.numeroControl ?? 'sin control'} ·{' '}
                        {enOtroGrupo
                          ? `ya está en ${alumno.grupo.nombre}`
                          : 'sin grupo'}
                      </span>
                    </span>
                  </label>
                )
              })}
              {disponibles.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No hay alumnos de esta carrera con esa búsqueda.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A quien ya está en otro grupo lo mueve el administrador.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={agregarExistentes}
              disabled={guardando || seleccion.length === 0}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-strong disabled:opacity-50"
            >
              {guardando ? 'Agregando...' : `Agregar ${seleccion.length || ''}`.trim()}
            </button>
          </div>
        )}

        {pestana === 'nuevo' && (
          <form onSubmit={crearAlumno} className="space-y-3">
            {[
              { campo: 'nombre', etiqueta: 'Nombre completo *', tipo: 'text', requerido: true },
              { campo: 'numeroControl', etiqueta: 'Número de control *', tipo: 'text', requerido: true, placeholder: '225Q0103' },
              { campo: 'password', etiqueta: 'Contraseña inicial *', tipo: 'password', requerido: true },
              { campo: 'email', etiqueta: 'Correo', tipo: 'email', requerido: false },
              { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'text', requerido: false, placeholder: '9611234567' },
            ].map((campo) => (
              <div key={campo.campo}>
                <label
                  htmlFor={`grupo-alumno-${campo.campo}`}
                  className="mb-1 block text-xs font-medium text-foreground"
                >
                  {campo.etiqueta}
                </label>
                <input
                  id={`grupo-alumno-${campo.campo}`}
                  type={campo.tipo}
                  required={campo.requerido}
                  minLength={campo.campo === 'password' ? 8 : undefined}
                  placeholder={campo.placeholder}
                  value={form[campo.campo]}
                  onChange={(event) =>
                    setForm({ ...form, [campo.campo]: event.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              La carrera y el semestre son los del grupo. Entrega la contraseña al
              alumno: podrá cambiarla desde su perfil.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-strong disabled:opacity-50"
            >
              {guardando ? 'Creando...' : 'Crear y agregar al grupo'}
            </button>
          </form>
        )}

        {pestana === 'importar' && (
          <div className="space-y-3">
            {resumenImportacion ? (
              <div className="space-y-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
                <p className="font-medium">Importación terminada</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Alumnos nuevos dados de alta: {resumenImportacion.creados}</li>
                  <li>
                    Cuentas que ya existían y entraron al grupo:{' '}
                    {resumenImportacion.vinculados}
                  </li>
                  <li>Ya estaban en el grupo: {resumenImportacion.yaEnGrupo}</li>
                </ul>
                {resumenImportacion.errores.length > 0 && (
                  <div>
                    <p className="font-medium text-destructive">
                      No se pudieron importar {resumenImportacion.errores.length}:
                    </p>
                    <ul className="list-inside list-disc text-destructive">
                      {resumenImportacion.errores.map((err, i) => (
                        <li key={i}>
                          {err.nombre}: {err.motivo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onListo('Lista importada.')}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-strong"
                >
                  Listo
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    Sube el documento con la lista del grupo (Excel .xlsx/.xls o
                    CSV). Sólo el nombre es obligatorio: si el archivo no trae
                    número de control, correo o teléfono, el alumno queda dado de
                    alta sin esos datos.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={manejarArchivo}
                    className="mt-3 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                  />
                  {archivoNombre && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Archivo cargado: {archivoNombre}
                    </p>
                  )}
                </div>

                {filasImportar.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        Revisa la lista antes de importar ({filasImportar.length}{' '}
                        alumno{filasImportar.length === 1 ? '' : 's'})
                      </p>
                      <button
                        type="button"
                        onClick={agregarFilaImportar}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        + Agregar fila
                      </button>
                    </div>
                    <div className="max-h-72 overflow-auto rounded-xl border border-border">
                      <table className="w-full min-w-[620px] text-sm">
                        <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-2 py-2">Nombre *</th>
                            <th className="px-2 py-2">Núm. control</th>
                            <th className="px-2 py-2">Correo</th>
                            <th className="px-2 py-2">Teléfono</th>
                            <th className="px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {filasImportar.map((fila, indice) => (
                            <tr key={indice} className="border-t border-border">
                              {['nombre', 'numeroControl', 'email', 'telefono'].map(
                                (campo) => (
                                  <td key={campo} className="px-2 py-1.5">
                                    <input
                                      value={fila[campo]}
                                      onChange={(event) =>
                                        actualizarFilaImportar(
                                          indice,
                                          campo,
                                          event.target.value,
                                        )
                                      }
                                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                                    />
                                  </td>
                                ),
                              )}
                              <td className="px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => quitarFilaImportar(indice)}
                                  className="text-xs font-medium text-destructive hover:underline"
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={confirmarImportacion}
                  disabled={guardando || filasImportar.length === 0}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-strong disabled:opacity-50"
                >
                  {guardando
                    ? 'Importando...'
                    : `Importar ${filasImportar.length || ''}`.trim()}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
