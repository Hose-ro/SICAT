import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useEffect, useRef, useState } from 'react'
import Modal from '../../components/Modal'
import api from '../../api/axios'
import {
  FILA_ALUMNO_VACIA,
  esNumeroControlValido,
  leerListaDeArchivo,
} from '../../lib/listaAlumnosArchivo'

const FORM_NUEVO = {
  nombre: '',
  numeroControl: '',
  password: '',
  email: '',
  telefono: '',
}

const FORM_COMPLETAR = {
  nombre: '',
  numeroControl: '',
  email: '',
  telefono: '',
  password: '',
}

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}

/**
 * Padrón de la materia. El docente inscribe alumnos que ya existen, da de
 * alta uno nuevo o importa una lista desde Excel/CSV; la inscripción es sólo
 * de esta materia y no mueve al alumno de grupo.
 */
export default function AlumnosMateriaCard({ materia, puedeEditar, onActualizado }) {
  const inscripciones = materia.inscripciones ?? []
  const grupos = materia.grupos ?? []

  const [modal, setModal] = useState(false)
  const [pestana, setPestana] = useState('existente')
  const [grupoId, setGrupoId] = useState(grupos.length === 1 ? String(grupos[0].id) : '')
  const [busqueda, setBusqueda] = useState('')
  const [disponibles, setDisponibles] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [form, setForm] = useState(FORM_NUEVO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const fileInputRef = useRef(null)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [filasImportar, setFilasImportar] = useState([])
  const [resumenImportacion, setResumenImportacion] = useState(null)

  const [completarModal, setCompletarModal] = useState(false)
  const [alumnoCompletar, setAlumnoCompletar] = useState(null)
  const [formCompletar, setFormCompletar] = useState(FORM_COMPLETAR)
  const [guardandoCompletar, setGuardandoCompletar] = useState(false)
  const [errorCompletar, setErrorCompletar] = useState('')

  useEffect(() => {
    if (!modal || pestana !== 'existente') return undefined
    let activo = true
    const temporizador = setTimeout(() => {
      api
        .get(`/inscripciones/materias/${materia.id}/alumnos-disponibles`, {
          params: busqueda.trim() ? { q: busqueda.trim() } : undefined,
        })
        .then((res) => { if (activo) setDisponibles(res.data) })
        .catch(() => { if (activo) setDisponibles([]) })
    }, 250)
    return () => {
      activo = false
      clearTimeout(temporizador)
    }
  }, [modal, pestana, busqueda, materia.id])

  const abrir = () => {
    setModal(true)
    setPestana('existente')
    setBusqueda('')
    setSeleccion([])
    setForm(FORM_NUEVO)
    setArchivoNombre('')
    setFilasImportar([])
    setResumenImportacion(null)
    setError('')
  }

  const cerrar = () => {
    if (guardando) return
    setModal(false)
  }

  const alternar = (id) => {
    setSeleccion((actual) =>
      actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id],
    )
  }

  const inscribirExistentes = async () => {
    if (!seleccion.length) return
    setGuardando(true)
    setError('')
    try {
      const { data } = await api.post(`/inscripciones/materias/${materia.id}/alumnos`, {
        alumnoIds: seleccion,
        ...(grupoId ? { grupoId: Number(grupoId) } : {}),
      })
      setAviso(`Inscritos: ${data.inscritos + data.reactivados}. Ya estaban: ${data.yaInscritos}.`)
      setModal(false)
      await onActualizado?.()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo inscribir a los alumnos'))
    } finally {
      setGuardando(false)
    }
  }

  const crearAlumno = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await api.post(`/inscripciones/materias/${materia.id}/alumnos/nuevo`, {
        nombre: form.nombre.trim(),
        numeroControl: form.numeroControl.trim().toUpperCase(),
        password: form.password,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
        ...(grupoId ? { grupoId: Number(grupoId) } : {}),
      })
      setAviso(`${form.nombre.trim()} quedó dado de alta e inscrito.`)
      setModal(false)
      await onActualizado?.()
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

    const conControlInvalido = validas.filter(
      (fila) => fila.numeroControl && !esNumeroControlValido(fila.numeroControl),
    )
    if (conControlInvalido.length > 0) {
      setError(
        `Revisa el número de control de ${conControlInvalido.length} alumno${conControlInvalido.length === 1 ? '' : 's'}: debe tener el formato 225Q0103 (8 caracteres). Puedes corregirlo o dejarlo en blanco.`,
      )
      return
    }

    setGuardando(true)
    setError('')
    try {
      const { data } = await api.post(`/inscripciones/materias/${materia.id}/alumnos/importar`, {
        alumnos: validas.map(({ nombre, numeroControl, email, telefono }) => ({
          nombre,
          ...(numeroControl ? { numeroControl: numeroControl.toUpperCase() } : {}),
          ...(email ? { email } : {}),
          ...(telefono ? { telefono } : {}),
        })),
        ...(grupoId ? { grupoId: Number(grupoId) } : {}),
      })
      setResumenImportacion(data)
      setFilasImportar([])
      setArchivoNombre('')
      await onActualizado?.()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo importar la lista'))
    } finally {
      setGuardando(false)
    }
  }

  const darDeBaja = useAsyncAction(async (alumno) => {
    if (!(await confirmAction(`¿Dar de baja a ${alumno.nombre} de esta materia?`))) return
    try {
      await api.delete(`/inscripciones/materias/${materia.id}/alumnos/${alumno.id}`)
      setAviso(`${alumno.nombre} salió del padrón de la materia.`)
      await onActualizado?.()
    } catch (err) {
      setAviso(mensajeError(err, 'No se pudo dar de baja al alumno'))
    }
  })

  const abrirCompletar = (alumno) => {
    setAlumnoCompletar(alumno)
    setFormCompletar({
      nombre: alumno.nombre || '',
      numeroControl: alumno.numeroControl || '',
      email: alumno.email || '',
      telefono: alumno.telefono || '',
      password: '',
    })
    setErrorCompletar('')
    setCompletarModal(true)
  }

  const cerrarCompletar = () => {
    if (guardandoCompletar) return
    setCompletarModal(false)
  }

  const guardarCompletar = async (event) => {
    event.preventDefault()
    setGuardandoCompletar(true)
    setErrorCompletar('')
    try {
      const payload = {}
      const nombre = formCompletar.nombre.trim()
      if (nombre && nombre !== alumnoCompletar.nombre) payload.nombre = nombre
      if (formCompletar.numeroControl.trim()) {
        payload.numeroControl = formCompletar.numeroControl.trim().toUpperCase()
      }
      if (formCompletar.email.trim()) payload.email = formCompletar.email.trim()
      if (formCompletar.telefono.trim()) payload.telefono = formCompletar.telefono.trim()
      if (formCompletar.password.trim()) payload.password = formCompletar.password.trim()

      await api.patch(
        `/inscripciones/materias/${materia.id}/alumnos/${alumnoCompletar.id}`,
        payload,
      )
      setAviso(`Datos de ${nombre || alumnoCompletar.nombre} actualizados.`)
      setCompletarModal(false)
      await onActualizado?.()
    } catch (err) {
      setErrorCompletar(mensajeError(err, 'No se pudo actualizar al alumno'))
    } finally {
      setGuardandoCompletar(false)
    }
  }

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alumnos inscritos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Busca a un alumno que ya tenga cuenta, da de alta a uno nuevo o importa la lista completa del grupo desde un Excel.
          </p>
        </div>
        {puedeEditar && (
          <Button variant="default"
            type="button"
            onClick={abrir}
            className="px-3 py-2 text-sm font-medium"
          >
            Agregar alumnos
          </Button>
        )}
      </div>

      {aviso && (
        <p className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-foreground">
          {aviso}
        </p>
      )}

      <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de alumnos inscritos">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-3">Nombre</th>
              <th className="px-2 py-3">Control</th>
              <th className="px-2 py-3">Correo</th>
              <th className="px-2 py-3">Teléfono</th>
              {puedeEditar && <th className="px-2 py-3" />}
            </tr>
          </thead>
          <tbody>
            {inscripciones.map((inscripcion) => {
              const alumno = inscripcion.alumno
              const datosIncompletos = !alumno.numeroControl
              return (
                <tr key={inscripcion.id} className="border-b border-border">
                  <td className="px-2 py-3 font-medium text-foreground">
                    {alumno.nombre}
                    {datosIncompletos && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                        Datos incompletos
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{alumno.numeroControl ?? '—'}</td>
                  <td className="px-2 py-3 text-muted-foreground">{alumno.email ?? '—'}</td>
                  <td className="px-2 py-3 text-muted-foreground">{alumno.telefono ?? '—'}</td>
                  {puedeEditar && (
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline"
                          type="button"
                          onClick={() => abrirCompletar(alumno)}
                          className="border px-3 py-1.5 text-xs font-medium"
                        >
                          {datosIncompletos ? 'Completar datos' : 'Editar'}
                        </Button>
                        <Button variant="destructive"
                          type="button"
                          onClick={() => darDeBaja(alumno)}
                          className="border px-3 py-1.5 text-xs font-medium"
                        >
                          Dar de baja
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {inscripciones.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay alumnos aceptados en esta materia.</p>
        )}
      </div>

      <Modal open={modal} onClose={cerrar} title="Agregar alumnos a la materia" wide={pestana === 'importar'}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { clave: 'existente', etiqueta: 'Buscar existente' },
              { clave: 'nuevo', etiqueta: 'Crear uno nuevo' },
              { clave: 'importar', etiqueta: 'Importar lista (Excel)' },
            ].map((opcion) => (
              <Button variant="ghost"
                key={opcion.clave}
                type="button"
                onClick={() => { setPestana(opcion.clave); setError('') }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  pestana === opcion.clave
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-border"
                }`}
              >
                {opcion.etiqueta}
              </Button>
            ))}
          </div>

          {grupos.length > 1 && (
            <div>
              <label htmlFor="inscripcion-grupo" className="mb-1 block text-xs font-medium text-foreground">
                Grupo de la clase
              </label>
              <select
                id="inscripcion-grupo"
                value={grupoId}
                onChange={(event) => setGrupoId(event.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin grupo</option>
                {grupos.map((grupo) => (
                  <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {pestana === 'existente' && (
            <div className="space-y-3">
              <input aria-label="Buscar por nombre o número de control"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre o número de control"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                {disponibles.map((alumno) => (
                  <label key={alumno.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-background">
                    <input
                      type="checkbox"
                      checked={seleccion.includes(alumno.id)}
                      onChange={() => alternar(alumno.id)}
                    />
                    <span className="text-sm text-foreground">
                      {alumno.nombre}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {alumno.numeroControl ?? 'sin control'} · {alumno.grupo?.nombre ?? 'sin grupo'}
                      </span>
                    </span>
                  </label>
                ))}
                {disponibles.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No hay alumnos disponibles con esa búsqueda.
                  </p>
                )}
              </div>
              {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
              <Button variant="default"
                type="button"
                onClick={inscribirExistentes}
                disabled={guardando || seleccion.length === 0}
                className="w-full py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {guardando ? 'Inscribiendo...' : `Inscribir ${seleccion.length || ''}`.trim()}
              </Button>
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
                  <label htmlFor={`alumno-${campo.campo}`} className="mb-1 block text-xs font-medium text-foreground">
                    {campo.etiqueta}
                  </label>
                  <input
                    id={`alumno-${campo.campo}`}
                    type={campo.tipo}
                    required={campo.requerido}
                    minLength={campo.campo === 'password' ? 8 : undefined}
                    placeholder={campo.placeholder}
                    value={form[campo.campo]}
                    onChange={(event) => setForm({ ...form, [campo.campo]: event.target.value })}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Entrega la contraseña al alumno: podrá cambiarla desde su perfil.
              </p>
              {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
              <Button variant="default"
                type="submit"
                disabled={guardando}
                className="w-full py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {guardando ? 'Creando...' : 'Crear e inscribir'}
              </Button>
            </form>
          )}

          {pestana === 'importar' && (
            <div className="space-y-3">
              {resumenImportacion ? (
                <div className="space-y-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success-foreground">
                  <p className="font-medium">Importación terminada</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>Alumnos nuevos dados de alta: {resumenImportacion.creados}</li>
                    <li>Vinculados a una cuenta que ya existía: {resumenImportacion.vinculados}</li>
                    <li>Ya estaban inscritos: {resumenImportacion.yaInscritos}</li>
                  </ul>
                  {resumenImportacion.errores.length > 0 && (
                    <div>
                      <p className="font-medium text-warning-foreground">No se pudieron importar {resumenImportacion.errores.length}:</p>
                      <ul className="list-inside list-disc text-warning-foreground">
                        {resumenImportacion.errores.map((err, i) => (
                          <li key={i}>{err.nombre}: {err.motivo}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-success-foreground">
                    Los alumnos que quedaron sólo con nombre aparecen marcados como "Datos incompletos" en la lista; usa "Completar datos" para agregarles número de control, correo o contraseña cuando los tengas.
                  </p>
                  <Button variant="default"
                    type="button"
                    onClick={() => setModal(false)}
                    className="w-full py-2.5 text-sm font-medium"
                  >
                    Listo
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-dashed border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">
                      Sube el documento con la lista del grupo (Excel .xlsx/.xls o CSV). No importa el orden de las columnas ni
                      que traiga encabezado: el número de control, el correo y el teléfono se reconocen solos. Sólo el nombre es
                      obligatorio; lo demás podrás completarlo después desde esta misma lista.
                    </p>
                    <input aria-label="Archivo de alumnos (Excel o CSV)"
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={manejarArchivo}
                      className="mt-3 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary-strong"
                    />
                    {archivoNombre && (
                      <p className="mt-2 text-xs text-muted-foreground">Archivo cargado: {archivoNombre}</p>
                    )}
                  </div>

                  {filasImportar.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          Revisa la lista antes de importar ({filasImportar.length} alumno{filasImportar.length === 1 ? '' : 's'})
                        </p>
                        <Button variant="ghost"
                          type="button"
                          onClick={agregarFilaImportar}
                          className="text-xs font-medium text-primary-ink hover:underline"
                        >
                          + Agregar fila
                        </Button>
                      </div>
                      <div className="max-h-72 overflow-auto rounded-xl border border-border">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead className="sticky top-0 bg-background text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                                {['nombre', 'numeroControl', 'email', 'telefono'].map((campo) => {
                                  const invalido =
                                    campo === 'numeroControl' &&
                                    Boolean(fila.numeroControl.trim()) &&
                                    !esNumeroControlValido(fila.numeroControl)
                                  return (
                                    <td key={campo} className="px-2 py-1.5">
                                      <input aria-label={`${campo} del alumno ${indice + 1}`}
                                        value={fila[campo]}
                                        onChange={(event) => actualizarFilaImportar(indice, campo, event.target.value)}
                                        title={invalido ? 'Debe tener el formato 225Q0103' : undefined}
                                        className={`w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                          invalido ? "border-destructive/30" : "border-border"
                                        }`}
                                      />
                                    </td>
                                  )
                                })}
                                <td className="px-2 py-1.5 text-right">
                                  <Button variant="destructive"
                                    type="button"
                                    onClick={() => quitarFilaImportar(indice)}
                                    className="text-xs font-medium hover:underline"
                                  >
                                    Quitar
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}

                  <Button variant="default"
                    type="button"
                    onClick={confirmarImportacion}
                    disabled={guardando || filasImportar.length === 0}
                    className="w-full py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {guardando ? 'Importando...' : `Importar ${filasImportar.length || ''}`.trim()}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={completarModal} onClose={cerrarCompletar} title={`Editar alumno — ${alumnoCompletar?.nombre ?? ''}`}>
        <form onSubmit={guardarCompletar} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {alumnoCompletar && !alumnoCompletar.numeroControl
              ? 'Este alumno se dio de alta sólo con su nombre. Agrega lo que tengas a la mano; puedes completar el resto más tarde.'
              : 'Corrige los datos del alumno. Deja la contraseña vacía si no quieres cambiarla.'}
          </p>
          {[
            { campo: 'nombre', etiqueta: 'Nombre completo', tipo: 'text' },
            { campo: 'numeroControl', etiqueta: 'Número de control', tipo: 'text', placeholder: '225Q0103' },
            { campo: 'email', etiqueta: 'Correo', tipo: 'email' },
            { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'text', placeholder: '9611234567' },
            { campo: 'password', etiqueta: 'Contraseña (déjalo vacío para no cambiarla)', tipo: 'password' },
          ].map((campo) => (
            <div key={campo.campo}>
              <label htmlFor={`completar-${campo.campo}`} className="mb-1 block text-xs font-medium text-foreground">
                {campo.etiqueta}
              </label>
              <input
                id={`completar-${campo.campo}`}
                type={campo.tipo}
                minLength={campo.campo === 'password' ? 8 : undefined}
                placeholder={campo.placeholder}
                value={formCompletar[campo.campo]}
                onChange={(event) => setFormCompletar({ ...formCompletar, [campo.campo]: event.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ))}
          {!formCompletar.numeroControl && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              Sin número de control, correo o contraseña real el alumno no podrá iniciar sesión todavía.
            </p>
          )}
          {errorCompletar && <p role="alert" className="text-sm text-destructive-foreground">{errorCompletar}</p>}
          <Button variant="default"
            type="submit"
            disabled={guardandoCompletar}
            className="w-full py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {guardandoCompletar ? 'Guardando...' : 'Guardar datos'}
          </Button>
        </form>
      </Modal>
    </article>
  )
}
