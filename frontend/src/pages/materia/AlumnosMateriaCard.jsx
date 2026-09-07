import { useEffect, useRef, useState } from 'react'
import Modal from '../../components/Modal'
import api from '../../api/axios'
import {
  FILA_ALUMNO_VACIA,
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

  const darDeBaja = async (alumno) => {
    if (!window.confirm(`¿Dar de baja a ${alumno.nombre} de esta materia?`)) return
    try {
      await api.delete(`/inscripciones/materias/${materia.id}/alumnos/${alumno.id}`)
      setAviso(`${alumno.nombre} salió del padrón de la materia.`)
      await onActualizado?.()
    } catch (err) {
      setAviso(mensajeError(err, 'No se pudo dar de baja al alumno'))
    }
  }

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
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Alumnos inscritos</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Busca a un alumno que ya tenga cuenta, da de alta a uno nuevo o importa la lista completa del grupo desde un Excel.
          </p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            onClick={abrir}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Agregar alumnos
          </button>
        )}
      </div>

      {aviso && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {aviso}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
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
                <tr key={inscripcion.id} className="border-b border-gray-50">
                  <td className="px-2 py-3 font-medium text-gray-800">
                    {alumno.nombre}
                    {datosIncompletos && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Datos incompletos
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-gray-500">{alumno.numeroControl ?? '—'}</td>
                  <td className="px-2 py-3 text-gray-500">{alumno.email ?? '—'}</td>
                  <td className="px-2 py-3 text-gray-500">{alumno.telefono ?? '—'}</td>
                  {puedeEditar && (
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirCompletar(alumno)}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                        >
                          {datosIncompletos ? 'Completar datos' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => darDeBaja(alumno)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Dar de baja
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {inscripciones.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">No hay alumnos aceptados en esta materia.</p>
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
              <button
                key={opcion.clave}
                type="button"
                onClick={() => { setPestana(opcion.clave); setError('') }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  pestana === opcion.clave
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          {grupos.length > 1 && (
            <div>
              <label htmlFor="inscripcion-grupo" className="mb-1 block text-xs font-medium text-gray-700">
                Grupo de la clase
              </label>
              <select
                id="inscripcion-grupo"
                value={grupoId}
                onChange={(event) => setGrupoId(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre o número de control"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
                {disponibles.map((alumno) => (
                  <label key={alumno.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={seleccion.includes(alumno.id)}
                      onChange={() => alternar(alumno.id)}
                    />
                    <span className="text-sm text-gray-800">
                      {alumno.nombre}
                      <span className="ml-2 text-xs text-gray-400">
                        {alumno.numeroControl ?? 'sin control'} · {alumno.grupo?.nombre ?? 'sin grupo'}
                      </span>
                    </span>
                  </label>
                ))}
                {disponibles.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-gray-400">
                    No hay alumnos disponibles con esa búsqueda.
                  </p>
                )}
              </div>
              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
              <button
                type="button"
                onClick={inscribirExistentes}
                disabled={guardando || seleccion.length === 0}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? 'Inscribiendo...' : `Inscribir ${seleccion.length || ''}`.trim()}
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
                  <label htmlFor={`alumno-${campo.campo}`} className="mb-1 block text-xs font-medium text-gray-700">
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
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500">
                Entrega la contraseña al alumno: podrá cambiarla desde su perfil.
              </p>
              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={guardando}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? 'Creando...' : 'Crear e inscribir'}
              </button>
            </form>
          )}

          {pestana === 'importar' && (
            <div className="space-y-3">
              {resumenImportacion ? (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-medium">Importación terminada</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>Alumnos nuevos dados de alta: {resumenImportacion.creados}</li>
                    <li>Vinculados a una cuenta que ya existía: {resumenImportacion.vinculados}</li>
                    <li>Ya estaban inscritos: {resumenImportacion.yaInscritos}</li>
                  </ul>
                  {resumenImportacion.errores.length > 0 && (
                    <div>
                      <p className="font-medium text-amber-700">No se pudieron importar {resumenImportacion.errores.length}:</p>
                      <ul className="list-inside list-disc text-amber-700">
                        {resumenImportacion.errores.map((err, i) => (
                          <li key={i}>{err.nombre}: {err.motivo}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-emerald-700">
                    Los alumnos que quedaron sólo con nombre aparecen marcados como "Datos incompletos" en la lista; usa "Completar datos" para agregarles número de control, correo o contraseña cuando los tengas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModal(false)}
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Listo
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                      Sube el documento con la lista del grupo (Excel .xlsx/.xls o CSV). Sólo el nombre es obligatorio: si el
                      archivo no trae número de control, correo o teléfono, podrás completarlos después desde esta misma lista.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={manejarArchivo}
                      className="mt-3 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                    />
                    {archivoNombre && (
                      <p className="mt-2 text-xs text-gray-500">Archivo cargado: {archivoNombre}</p>
                    )}
                  </div>

                  {filasImportar.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          Revisa la lista antes de importar ({filasImportar.length} alumno{filasImportar.length === 1 ? '' : 's'})
                        </p>
                        <button
                          type="button"
                          onClick={agregarFilaImportar}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          + Agregar fila
                        </button>
                      </div>
                      <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
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
                              <tr key={indice} className="border-t border-gray-100">
                                {['nombre', 'numeroControl', 'email', 'telefono'].map((campo) => (
                                  <td key={campo} className="px-2 py-1.5">
                                    <input
                                      value={fila[campo]}
                                      onChange={(event) => actualizarFilaImportar(indice, campo, event.target.value)}
                                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => quitarFilaImportar(indice)}
                                    className="text-xs font-medium text-red-500 hover:underline"
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

                  {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

                  <button
                    type="button"
                    onClick={confirmarImportacion}
                    disabled={guardando || filasImportar.length === 0}
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {guardando ? 'Importando...' : `Importar ${filasImportar.length || ''}`.trim()}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={completarModal} onClose={cerrarCompletar} title={`Editar alumno — ${alumnoCompletar?.nombre ?? ''}`}>
        <form onSubmit={guardarCompletar} className="space-y-3">
          <p className="text-xs text-gray-500">
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
              <label htmlFor={`completar-${campo.campo}`} className="mb-1 block text-xs font-medium text-gray-700">
                {campo.etiqueta}
              </label>
              <input
                id={`completar-${campo.campo}`}
                type={campo.tipo}
                minLength={campo.campo === 'password' ? 8 : undefined}
                placeholder={campo.placeholder}
                value={formCompletar[campo.campo]}
                onChange={(event) => setFormCompletar({ ...formCompletar, [campo.campo]: event.target.value })}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          {!formCompletar.numeroControl && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Sin número de control, correo o contraseña real el alumno no podrá iniciar sesión todavía.
            </p>
          )}
          {errorCompletar && <p role="alert" className="text-sm text-red-500">{errorCompletar}</p>}
          <button
            type="submit"
            disabled={guardandoCompletar}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {guardandoCompletar ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </Modal>
    </article>
  )
}
