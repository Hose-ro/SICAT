import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'
import { EMAIL_AUTH_ENABLED } from '../lib/authFeatures'

const ROL_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-700',
  JEFE_CARRERA: 'bg-amber-100 text-amber-700',
  DOCENTE: 'bg-blue-100 text-blue-700',
  ALUMNO: 'bg-green-100 text-green-700',
}

const AUTH_EVENT_LABELS = {
  REGISTRO: 'Registro',
  LOGIN_EXITOSO: 'Inicio de sesión',
  LOGIN_FALLIDO: 'Acceso rechazado',
  LOGOUT: 'Cierre de sesión',
  CAMBIO_PASSWORD: 'Cambio de contraseña',
  SOLICITUD_RECUPERACION: 'Solicitud de recuperación',
  PASSWORD_RESTABLECIDA: 'Contraseña restablecida',
  CORREO_VERIFICADO: 'Correo verificado',
  CUENTA_APROBADA: 'Cuenta aprobada',
  CUENTA_DESACTIVADA: 'Cuenta desactivada',
  CUENTA_ACTIVADA: 'Cuenta activada',
  ROL_CAMBIADO: 'Rol modificado',
}

const getApiError = (error, fallback) => {
  const message = error.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : (message ?? fallback)
}

/**
 * El correo sólo condiciona la aprobación cuando el acceso por correo está
 * activo; con él apagado el alumno se identifica por número de control.
 */
const puedeAprobar = (user) => !EMAIL_AUTH_ENABLED || Boolean(user.emailVerificadoAt)

const getAccountStatus = (user) => {
  if (!user.activo) {
    return { label: 'Inactivo', className: 'bg-gray-100 text-gray-500' }
  }
  if (user.rol === 'ALUMNO' && !user.registroAprobado) {
    return puedeAprobar(user)
      ? { label: 'Pendiente de aprobación', className: 'bg-blue-100 text-blue-700' }
      : { label: 'Pendiente de correo', className: 'bg-amber-100 text-amber-700' }
  }
  return { label: 'Activo', className: 'bg-green-100 text-green-700' }
}

const EMPTY_FORM = {
  nombre: '', email: '', username: '', numeroControl: '',
  password: '', rol: 'DOCENTE', academiaId: '', telefono: '',
  semestre: '', carreraId: '', carreraIds: [], activo: true,
}

const norm = {
  nombre: (v) => (v ?? '').trim().replace(/\s+/g, ' '),
  email: (v) => (v ?? '').trim().toLowerCase(),
  username: (v) => (v ?? '').trim().toLowerCase(),
  numeroControl: (v) => (v ?? '').trim().toUpperCase(),
  telefono: (v) => (v ?? '').replace(/\D/g, ''),
}

const buildFormFromUser = (user) => ({
  ...EMPTY_FORM,
  nombre: user.nombre ?? '',
  email: user.email ?? '',
  username: user.username ?? '',
  numeroControl: user.numeroControl ?? '',
  rol: user.rol,
  academiaId: user.academias?.[0]?.id ? String(user.academias[0].id) : '',
  telefono: user.telefono ?? '',
  semestre: user.semestre != null ? String(user.semestre) : '',
  carreraId: user.carrera?.id ? String(user.carrera.id) : '',
  carreraIds: user.carrerasJefe?.map((item) => item.carrera.id) ?? [],
  activo: user.activo,
})

/** Sólo envía los campos que realmente cambiaron; '' equivale a limpiar el dato. */
const buildEditPayload = (user, form) => {
  const payload = {}
  const esAlumno = form.rol === 'ALUMNO'

  const nombre = norm.nombre(form.nombre)
  if (nombre && nombre !== user.nombre) payload.nombre = nombre

  const opcionales = {
    email: norm.email(form.email),
    username: esAlumno ? '' : norm.username(form.username),
    numeroControl: esAlumno ? norm.numeroControl(form.numeroControl) : '',
    telefono: norm.telefono(form.telefono),
  }
  Object.entries(opcionales).forEach(([campo, valor]) => {
    const siguiente = valor === '' ? null : valor
    if (siguiente !== (user[campo] ?? null)) payload[campo] = siguiente
  })

  const rolCambio = form.rol !== user.rol
  if (rolCambio) payload.rol = form.rol

  if (esAlumno) {
    const carreraId = form.carreraId ? Number(form.carreraId) : null
    const semestre = form.semestre ? Number(form.semestre) : null
    if (carreraId !== (user.carrera?.id ?? null)) payload.carreraId = carreraId
    if (semestre !== (user.semestre ?? null)) payload.semestre = semestre
  }
  if (form.rol === 'DOCENTE') {
    const academiaId = form.academiaId ? Number(form.academiaId) : null
    if (academiaId !== (user.academias?.[0]?.id ?? null)) payload.academiaId = academiaId
  }
  if (form.rol === 'JEFE_CARRERA') {
    const actuales = user.carrerasJefe?.map((item) => item.carrera.id) ?? []
    const cambio = actuales.length !== form.carreraIds.length
      || actuales.some((id) => !form.carreraIds.includes(id))
    if (rolCambio || cambio) payload.carreraIds = form.carreraIds
  }
  if (form.activo !== user.activo) payload.activo = form.activo

  return payload
}

function UsuarioFormFields({ form, setForm, carreras, academias, mode }) {
  const isEdit = mode === 'edit'
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Rol *</label>
        <select
          value={form.rol}
          onChange={(e) => setForm({
            ...form,
            rol: e.target.value,
            academiaId: e.target.value === 'DOCENTE' ? form.academiaId : '',
            carreraId: e.target.value === 'ALUMNO' ? form.carreraId : '',
            carreraIds: e.target.value === 'JEFE_CARRERA' ? form.carreraIds : [],
            semestre: e.target.value === 'ALUMNO' ? form.semestre : '',
            numeroControl: e.target.value === 'ALUMNO' ? form.numeroControl : '',
            username: e.target.value === 'ALUMNO' ? '' : form.username,
          })}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="DOCENTE">Docente</option>
          <option value="JEFE_CARRERA">Jefe de carrera</option>
          <option value="ALUMNO">Alumno</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
        <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {form.rol === 'ALUMNO' ? 'Número de control' : 'Usuario (username)'}
        </label>
        {form.rol === 'ALUMNO' ? (
          <input required value={form.numeroControl} onChange={(e) => setForm({ ...form, numeroControl: e.target.value })}
            placeholder="225Q0103"
            pattern="\d{3}[A-Za-z]\d{4}"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        ) : (
          <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="prof.garcia"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {isEdit && (
          <p className="mt-1 text-xs text-gray-400">
            Cambiar el correo cierra las sesiones activas y exige verificarlo de nuevo.
          </p>
        )}
      </div>
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
          <input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {form.rol === 'DOCENTE' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Academia</label>
          <select
            value={form.academiaId}
            onChange={(e) => setForm({ ...form, academiaId: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona academia</option>
            {academias.map((academia) => (
              <option key={academia.id} value={academia.id}>
                {academia.nombre}
              </option>
            ))}
          </select>
          {academias.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              No hay academias activas registradas.
            </p>
          )}
        </div>
      )}
      {form.rol === 'ALUMNO' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Carrera</label>
            <select required value={form.carreraId} onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona carrera</option>
              {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semestre</label>
            <input required type="number" min={1} max={12} value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </>
      )}
      {form.rol === 'JEFE_CARRERA' && (
        <fieldset className="space-y-2 rounded-xl border border-gray-200 p-3">
          <legend className="px-1 text-xs font-medium text-gray-700">Carreras asignadas *</legend>
          {carreras.map((carrera) => (
            <label key={carrera.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.carreraIds.includes(carrera.id)}
                onChange={(event) => setForm({
                  ...form,
                  carreraIds: event.target.checked
                    ? [...form.carreraIds, carrera.id]
                    : form.carreraIds.filter((id) => id !== carrera.id),
                })}
              />
              <span>{carrera.codigo} · {carrera.nombre}</span>
            </label>
          ))}
          {!carreras.length && <p className="text-xs text-amber-600">No hay carreras registradas.</p>}
        </fieldset>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
        <input type="tel" pattern="\d{10}" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {isEdit && (
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
          <span>Cuenta activa</span>
        </label>
      )}
    </>
  )
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroCarrera, setFiltroCarrera] = useState('')
  const [academias, setAcademias] = useState([])
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState({ open: false, user: null })
  const [careerModal, setCareerModal] = useState({ open: false, user: null, carreraIds: [] })
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editModal, setEditModal] = useState({
    open: false,
    user: null,
    form: EMPTY_FORM,
    error: '',
    loading: false,
  })
  const [pwModal, setPwModal] = useState({ open: false, user: null })
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [formError, setFormError] = useState('')
  const [confirmation, setConfirmation] = useState({
    open: false,
    user: null,
    action: null,
    loading: false,
    error: '',
  })
  const [authAudit, setAuthAudit] = useState({ loading: false, items: [], error: '' })

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchNombre = u.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
    const matchCarrera = filtroCarrera === ''
      || u.carrera?.id === parseInt(filtroCarrera)
      || u.carrerasJefe?.some((item) => item.carrera.id === parseInt(filtroCarrera))
    return matchNombre && matchCarrera
  })

  const fetchUsuarios = useCallback(() => {
    const q = filtroRol ? `?rol=${filtroRol}` : ''
    api.get(`/usuarios${q}`).then((r) => setUsuarios(r.data))
  }, [filtroRol])

  useEffect(() => {
    fetchUsuarios()
    api.get('/carreras').then((r) => setCarreras(r.data))
    api.get('/academias').then((r) => setAcademias(r.data)).catch(() => {})
  }, [fetchUsuarios])

  const crear = async (e) => {
    e.preventDefault()
    setFormError('')
    const data = { ...form }
    delete data.activo
    if (!data.email) delete data.email
    if (!data.username) delete data.username
    if (!data.numeroControl) delete data.numeroControl
    if (!data.academiaId || data.rol !== 'DOCENTE') delete data.academiaId
    else data.academiaId = parseInt(data.academiaId)
    if (!data.telefono) delete data.telefono
    if (!data.semestre) delete data.semestre
    else data.semestre = parseInt(data.semestre)
    if (!data.carreraId) delete data.carreraId
    else data.carreraId = parseInt(data.carreraId)
    if (data.rol !== 'JEFE_CARRERA') delete data.carreraIds
    try {
      await api.post('/usuarios', data)
      setModal(false)
      setForm(EMPTY_FORM)
      fetchUsuarios()
    } catch (err) {
      setFormError(getApiError(err, 'No se pudo crear el usuario'))
    }
  }

  const abrirEdicion = (user) => {
    setEditModal({
      open: true,
      user,
      form: buildFormFromUser(user),
      error: '',
      loading: false,
    })
  }

  const cerrarEdicion = () => {
    setEditModal({ open: false, user: null, form: EMPTY_FORM, error: '', loading: false })
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    const { user, form: editForm } = editModal
    if (editForm.rol === 'JEFE_CARRERA' && !editForm.carreraIds.length) {
      setEditModal((current) => ({ ...current, error: 'Selecciona al menos una carrera' }))
      return
    }
    const payload = buildEditPayload(user, editForm)
    if (!Object.keys(payload).length) {
      cerrarEdicion()
      return
    }
    setEditModal((current) => ({ ...current, loading: true, error: '' }))
    try {
      await api.patch(`/usuarios/${user.id}`, payload)
      cerrarEdicion()
      fetchUsuarios()
    } catch (err) {
      setEditModal((current) => ({
        ...current,
        loading: false,
        error: getApiError(err, 'No se pudo actualizar el usuario'),
      }))
    }
  }

  const solicitarConfirmacion = (user, action) => {
    setConfirmation({ open: true, user, action, loading: false, error: '' })
  }

  const ejecutarAccion = async () => {
    const { user, action } = confirmation
    if (!user || !action) return
    setConfirmation((current) => ({ ...current, loading: true, error: '' }))
    try {
      if (action === 'approve') {
        await api.post(`/usuarios/${user.id}/aprobar-registro`)
      } else if (action === 'delete') {
        await api.delete(`/usuarios/${user.id}/permanente`)
      } else {
        await api.patch(`/usuarios/${user.id}`, { activo: !user.activo })
      }
      setConfirmation({ open: false, user: null, action: null, loading: false, error: '' })
      fetchUsuarios()
    } catch (err) {
      setConfirmation((current) => ({
        ...current,
        loading: false,
        error: getApiError(err, 'No se pudo actualizar la cuenta'),
      }))
    }
  }

  const abrirDetalle = async (user) => {
    setDetailModal({ open: true, user })
    setAuthAudit({ loading: true, items: [], error: '' })
    try {
      const response = await api.get(`/usuarios/${user.id}/auth-audit`)
      setAuthAudit({ loading: false, items: response.data, error: '' })
    } catch (err) {
      setAuthAudit({
        loading: false,
        items: [],
        error: getApiError(err, 'No se pudo cargar la actividad de acceso'),
      })
    }
  }

  const cambiarPassword = async (e) => {
    e.preventDefault()
    setPwMsg('')
    if (newPassword.length < 8) { setPwMsg('Mínimo 8 caracteres'); return }
    try {
      await api.patch(`/usuarios/${pwModal.user.id}`, { password: newPassword })
      setPwMsg('¡Contraseña actualizada!')
      setNewPassword('')
      setTimeout(() => setPwModal({ open: false, user: null }), 1200)
    } catch (err) {
      setPwMsg(getApiError(err, 'Error al cambiar'))
    }
  }

  const guardarCarrerasJefe = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      await api.put(`/usuarios/${careerModal.user.id}/carreras-jefe`, {
        carreraIds: careerModal.carreraIds,
      })
      setCareerModal({ open: false, user: null, carreraIds: [] })
      fetchUsuarios()
    } catch (err) {
      setFormError(getApiError(err, 'No se pudieron asignar las carreras'))
    }
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de administradores, jefaturas, docentes y alumnos"
        action={
          <button
            onClick={() => setModal(true)}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
          >
            + Nuevo usuario
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-3">
        {['', 'ADMIN', 'JEFE_CARRERA', 'DOCENTE', 'ALUMNO'].map((r) => (
          <button
            key={r}
            onClick={() => setFiltroRol(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filtroRol === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'}`}
          >
            {r === 'JEFE_CARRERA' ? 'Jefes de carrera' : (r || 'Todos')}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={filtroNombre}
          onChange={(e) => setFiltroNombre(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
        />
        <select
          value={filtroCarrera}
          onChange={(e) => setFiltroCarrera(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
        >
          <option value="">Todas las carreras</option>
          {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {(filtroNombre || filtroCarrera) && (
          <button
            onClick={() => { setFiltroNombre(''); setFiltroCarrera('') }}
            className="text-sm text-gray-400 hover:text-gray-600 px-2 transition"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Identificador</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">{u.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{u.numeroControl || u.username || u.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>{u.rol}</span>
                </td>
                <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getAccountStatus(u).className}`}>
                      {getAccountStatus(u).label}
                    </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {/* Ver detalle */}
                    <button
                      onClick={() => abrirDetalle(u)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition"
                    >
                      Ver
                    </button>

                    <button
                      onClick={() => abrirEdicion(u)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition"
                    >
                      Editar
                    </button>

                      {u.rol === 'JEFE_CARRERA' && (
                      <button
                        onClick={() => {
                          setFormError('')
                          setCareerModal({
                            open: true,
                            user: u,
                            carreraIds: u.carrerasJefe?.map((item) => item.carrera.id) ?? [],
                          })
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 transition"
                      >
                        Carreras
                      </button>
                      )}

                      {u.rol === 'ALUMNO' && u.activo && !u.registroAprobado && (
                        <button
                          onClick={() => solicitarConfirmacion(u, 'approve')}
                          disabled={!puedeAprobar(u)}
                          title={puedeAprobar(u) ? 'Aprobar registro' : 'El correo aún no está verificado'}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Aprobar
                        </button>
                      )}

                    {/* Toggle activar/desactivar */}
                    <button
                      onClick={() => solicitarConfirmacion(u, 'toggle')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        u.activo
                          ? 'text-orange-600 hover:bg-orange-50 border border-orange-200'
                          : 'text-green-600 hover:bg-green-50 border border-green-200'
                      }`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>

                    {/* Cambiar contraseña */}
                    <button
                      onClick={() => { setPwModal({ open: true, user: u }); setNewPassword(''); setPwMsg(''); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-blue-500 hover:bg-blue-50 border border-blue-200 transition"
                    >
                      Contraseña
                    </button>

                    <button
                      onClick={() => solicitarConfirmacion(u, 'delete')}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-red-200 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usuariosFiltrados.length === 0 && (
          <p className="text-center text-gray-400 py-10">No hay usuarios</p>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo usuario">
        <form onSubmit={crear} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <UsuarioFormFields
            form={form}
            setForm={setForm}
            carreras={carreras}
            academias={academias}
            mode="create"
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition mt-2">
            Crear usuario
          </button>
        </form>
      </Modal>

      {/* Modal: Detalle de usuario */}
      <Modal
        open={editModal.open}
        onClose={() => { if (!editModal.loading) cerrarEdicion() }}
        title={`Editar — ${editModal.user?.nombre ?? ''}`}
      >
        <form onSubmit={guardarEdicion} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <UsuarioFormFields
            form={editModal.form}
            setForm={(next) => setEditModal((current) => ({ ...current, form: next }))}
            carreras={carreras}
            academias={academias}
            mode="edit"
          />
          {editModal.error && <p role="alert" className="text-sm text-red-500">{editModal.error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={editModal.loading}
              onClick={cerrarEdicion}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editModal.loading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {editModal.loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false, user: null })} title="Información del usuario">
        {detailModal.user && (() => {
          const u = detailModal.user
          const rows = [
            { label: 'Nombre', value: u.nombre },
            { label: 'Rol', value: <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>{u.rol}</span> },
            { label: 'Estado', value: <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span> },
            { label: 'Correo', value: u.email || '—' },
            {
              label: 'Correo verificado',
              value: !EMAIL_AUTH_ENABLED
                ? 'No aplica'
                : u.email
                  ? (u.emailVerificadoAt ? 'Sí' : 'No')
                  : 'No aplica',
            },
            u.rol === 'ALUMNO' && {
              label: 'Aprobación',
              value: u.registroAprobado
                ? 'Aprobada'
                : puedeAprobar(u)
                  ? 'Pendiente de aprobación'
                  : 'Pendiente de correo',
            },
            { label: 'Username', value: u.username || '—' },
            { label: 'Núm. Control', value: u.numeroControl || '—' },
            { label: 'Teléfono', value: u.telefono || '—' },
            u.rol === 'ALUMNO' && { label: 'Carrera', value: u.carrera?.nombre || '—' },
            u.rol === 'ALUMNO' && { label: 'Semestre', value: u.semestre ?? '—' },
            u.rol === 'DOCENTE' && { label: 'Academia', value: u.academias?.length ? u.academias.map((a) => a.nombre).join(', ') : '—' },
            u.rol === 'JEFE_CARRERA' && { label: 'Carreras asignadas', value: u.carrerasJefe?.length ? u.carrerasJefe.map((item) => item.carrera.nombre).join(', ') : '—' },
            { label: 'Registro', value: new Date(u.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].filter(Boolean)

          return (
            <div className="space-y-0 divide-y divide-gray-100">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="text-gray-500 font-medium">{label}</span>
                  <span className="text-gray-800 text-right">{value}</span>
                </div>
              ))}
              <div className="space-y-3 py-4">
                <h4 className="text-sm font-semibold text-gray-800">Actividad de acceso</h4>
                {authAudit.loading && <p className="text-sm text-gray-500">Cargando actividad...</p>}
                {authAudit.error && <p role="alert" className="text-sm text-red-500">{authAudit.error}</p>}
                {!authAudit.loading && !authAudit.error && authAudit.items.length === 0 && (
                  <p className="text-sm text-gray-500">Sin eventos registrados.</p>
                )}
                {authAudit.items.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between">
                    <span className="font-medium text-gray-700">
                      {AUTH_EVENT_LABELS[event.tipo] ?? event.tipo}
                    </span>
                    <span className="text-gray-500">
                      {new Date(event.createdAt).toLocaleString('es-MX')}
                      {event.ip ? ` · ${event.ip}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal open={careerModal.open} onClose={() => setCareerModal({ open: false, user: null, carreraIds: [] })} title={`Carreras de ${careerModal.user?.nombre ?? ''}`}>
        <form onSubmit={guardarCarrerasJefe} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-gray-700">Selecciona una o varias carreras</legend>
            {carreras.map((carrera) => (
              <label key={carrera.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={careerModal.carreraIds.includes(carrera.id)}
                  onChange={(event) => setCareerModal((current) => ({
                    ...current,
                    carreraIds: event.target.checked
                      ? [...current.carreraIds, carrera.id]
                      : current.carreraIds.filter((id) => id !== carrera.id),
                  }))}
                />
                <span>{carrera.codigo} · {carrera.nombre}</span>
              </label>
            ))}
          </fieldset>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <button type="submit" disabled={!careerModal.carreraIds.length} className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Guardar asignación
          </button>
        </form>
      </Modal>

      {/* Modal: Cambiar contraseña de usuario */}
      <Modal open={pwModal.open} onClose={() => setPwModal({ open: false, user: null })} title={`Cambiar contraseña — ${pwModal.user?.nombre ?? ''}`}>
        <form onSubmit={cambiarPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password" required minLength={8} maxLength={72}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm font-medium ${pwMsg.startsWith('¡') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>
          )}
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition">
            Guardar nueva contraseña
          </button>
        </form>
      </Modal>

      <Modal
        open={confirmation.open}
        onClose={() => {
          if (!confirmation.loading) {
            setConfirmation({ open: false, user: null, action: null, loading: false, error: '' })
          }
        }}
        title={
          confirmation.action === 'approve'
            ? 'Aprobar registro'
            : confirmation.action === 'delete'
              ? 'Eliminar usuario'
              : 'Cambiar estado de cuenta'
        }
      >
        <div className="space-y-5">
          {confirmation.action === 'delete' ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Se eliminará definitivamente la cuenta de {confirmation.user?.nombre ?? 'este usuario'}. Esta acción no se puede deshacer.
              </p>
              <p className="text-sm text-gray-500">
                Se borrará también todo su historial académico: inscripciones, asistencias, calificaciones y entregas; si es docente, además sus tareas, sesiones de clase y horarios. Las materias, los grupos y las aulas se conservan.
              </p>
              <p className="text-sm text-gray-500">
                Si sólo quieres impedirle el acceso, usa <strong>Desactivar</strong> en su lugar.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              {confirmation.action === 'approve'
                ? `Se permitirá que ${confirmation.user?.nombre ?? 'el alumno'} inicie sesión.`
                : `${confirmation.user?.activo ? 'Se desactivará' : 'Se activará'} la cuenta de ${confirmation.user?.nombre ?? 'este usuario'}.`}
            </p>
          )}
          {confirmation.error && (
            <p role="alert" className="text-sm text-red-500">{confirmation.error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={confirmation.loading}
              onClick={() => setConfirmation({ open: false, user: null, action: null, loading: false, error: '' })}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={confirmation.loading}
              onClick={ejecutarAccion}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                confirmation.action === 'delete'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmation.loading
                ? 'Guardando...'
                : confirmation.action === 'delete'
                  ? 'Eliminar'
                  : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
