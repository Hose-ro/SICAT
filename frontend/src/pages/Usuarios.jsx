import { Button } from '@/components/ui/button'
import { useId, useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Eye, GraduationCap, KeyRound, Pencil, Power, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import SwipeableRow from '../components/SwipeableRow'
import api from '../api/axios'
import { EMAIL_AUTH_ENABLED } from '../lib/authFeatures'

const ROL_COLORS = {
  ADMIN: 'bg-muted text-foreground',
  JEFE_CARRERA: 'bg-muted text-foreground',
  DOCENTE: 'bg-muted text-foreground',
  ALUMNO: 'bg-muted text-foreground',
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
    return { label: 'Inactivo', className: "bg-muted text-muted-foreground" }
  }
  if (user.rol === 'ALUMNO' && !user.registroAprobado) {
    return puedeAprobar(user)
      ? { label: 'Pendiente de aprobación', className: "bg-accent text-primary-ink" }
      : { label: 'Pendiente de correo', className: "bg-warning/10 text-warning-foreground" }
  }
  return { label: 'Activo', className: "bg-success/10 text-success-foreground" }
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
  const fieldId = useId()
  const isEdit = mode === 'edit'
  return (
    <>
      <div>
        <label htmlFor={fieldId + '-control-132'} className="block text-xs font-medium text-foreground mb-1">Rol *</label>
        <select id={fieldId + '-control-132'}
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
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="DOCENTE">Docente</option>
          <option value="JEFE_CARRERA">Jefe de carrera</option>
          <option value="ALUMNO">Alumno</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div>
        <label htmlFor={fieldId + '-control-154'} className="block text-xs font-medium text-foreground mb-1">Nombre completo *</label>
        <input id={fieldId + '-control-154'} required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div>
        <p className="block text-xs font-medium text-foreground mb-1">
          {form.rol === 'ALUMNO' ? 'Número de control' : 'Usuario (username)'}
        </p>
        {form.rol === 'ALUMNO' ? (
          <input aria-label="225Q0103" required value={form.numeroControl} onChange={(e) => setForm({ ...form, numeroControl: e.target.value })}
            placeholder="225Q0103"
            pattern="\d{3}[A-Za-z]\d{4}"
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        ) : (
          <input aria-label="prof.garcia" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="prof.garcia"
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        )}
      </div>
      <div>
        <label htmlFor={fieldId + '-control-174'} className="block text-xs font-medium text-foreground mb-1">Correo electrónico</label>
        <input id={fieldId + '-control-174'} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {isEdit && (
          <p className="mt-1 text-xs text-muted-foreground">
            Cambiar el correo cierra las sesiones activas y exige verificarlo de nuevo.
          </p>
        )}
      </div>
      {!isEdit && (
        <div>
          <label htmlFor={fieldId + '-control-185'} className="block text-xs font-medium text-foreground mb-1">Contraseña *</label>
          <input id={fieldId + '-control-185'} required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      )}
      {form.rol === 'DOCENTE' && (
        <div>
          <label htmlFor={fieldId + '-control-192'} className="block text-xs font-medium text-foreground mb-1">Academia</label>
          <select id={fieldId + '-control-192'}
            value={form.academiaId}
            onChange={(e) => setForm({ ...form, academiaId: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Selecciona academia</option>
            {academias.map((academia) => (
              <option key={academia.id} value={academia.id}>
                {academia.nombre}
              </option>
            ))}
          </select>
          {academias.length === 0 && (
            <p className="mt-1 text-xs text-warning-foreground">
              No hay academias activas registradas.
            </p>
          )}
        </div>
      )}
      {form.rol === 'ALUMNO' && (
        <>
          <div>
            <label htmlFor={fieldId + '-control-215'} className="block text-xs font-medium text-foreground mb-1">Carrera</label>
            <select id={fieldId + '-control-215'} required value={form.carreraId} onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Selecciona carrera</option>
              {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={fieldId + '-control-223'} className="block text-xs font-medium text-foreground mb-1">Semestre</label>
            <input id={fieldId + '-control-223'} required type="number" min={1} max={12} value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </>
      )}
      {form.rol === 'JEFE_CARRERA' && (
        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-xs font-medium text-foreground">Carreras asignadas *</legend>
          {carreras.map((carrera) => (
            <label key={carrera.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-background">
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
          {!carreras.length && <p className="text-xs text-warning-foreground">No hay carreras registradas.</p>}
        </fieldset>
      )}
      <div>
        <label htmlFor={fieldId + '-control-251'} className="block text-xs font-medium text-foreground mb-1">Teléfono</label>
        <input id={fieldId + '-control-251'} type="tel" pattern="\d{10}" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {isEdit && (
        <label className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground">
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
  const fieldId = useId()
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
  const [aviso, setAviso] = useState('')
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
    setAviso('')
    try {
      if (action === 'approve') {
        const { data } = await api.post(`/usuarios/${user.id}/aprobar-registro`)
        setAviso(
          data?.grupo?.nombre
            ? `${user.nombre} quedó aprobado y asignado al grupo ${data.grupo.nombre}.`
            : `${user.nombre} quedó aprobado. Asígnale un grupo desde Grupos cuando haya uno de su semestre.`,
        )
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

  const abrirCarreras = (u) => {
    setFormError('')
    setCareerModal({
      open: true,
      user: u,
      carreraIds: u.carrerasJefe?.map((item) => item.carrera.id) ?? [],
    })
  }

  const abrirPassword = (u) => {
    setPwModal({ open: true, user: u })
    setNewPassword('')
    setPwMsg('')
  }

  /** Acciones reveladas al deslizar una fila en la lista móvil (mismas que los botones de escritorio). */
  const accionesMovil = (u) => [
    { key: 'ver', label: 'Ver', icon: <Eye className="h-4 w-4" />, className: "bg-muted", onClick: () => abrirDetalle(u) },
    { key: 'editar', label: 'Editar', icon: <Pencil className="h-4 w-4" />, className: "bg-primary text-primary-foreground", onClick: () => abrirEdicion(u) },
    u.rol === 'JEFE_CARRERA' && {
      key: 'carreras', label: 'Carreras', icon: <GraduationCap className="h-4 w-4" />, className: "bg-warning", onClick: () => abrirCarreras(u),
    },
    u.rol === 'ALUMNO' && u.activo && !u.registroAprobado && {
      key: 'aprobar', label: 'Aprobar', icon: <CheckCircle2 className="h-4 w-4" />, className: "bg-success text-success-on-fill",
      disabled: !puedeAprobar(u), onClick: () => solicitarConfirmacion(u, 'approve'),
    },
    {
      key: 'toggle', label: u.activo ? 'Desactivar' : 'Activar', icon: <Power className="h-4 w-4" />,
      className: u.activo ? "bg-warning text-warning-on-fill" : "bg-success text-success-on-fill", onClick: () => solicitarConfirmacion(u, 'toggle'),
    },
    { key: 'password', label: 'Clave', icon: <KeyRound className="h-4 w-4" />, className: "bg-primary text-primary-foreground", onClick: () => abrirPassword(u) },
    { key: 'eliminar', label: 'Eliminar', icon: <Trash2 className="h-4 w-4" />, className: "bg-destructive text-destructive-on-fill", onClick: () => solicitarConfirmacion(u, 'delete') },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de administradores, jefaturas, docentes y alumnos"
        action={
          <Button variant="default"
            onClick={() => setModal(true)}
            className="w-full px-4 py-2 text-sm font-medium sm:w-auto"
          >
            + Nuevo usuario
          </Button>
        }
      />

      {aviso && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground">
          <span>{aviso}</span>
          <Button variant="ghost" onClick={() => setAviso('')} className="text-success-foreground hover:text-success-foreground" aria-label="Cerrar aviso">✕</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {['', 'ADMIN', 'JEFE_CARRERA', 'DOCENTE', 'ALUMNO'].map((r) => (
          <Button variant="ghost"
            key={r}
            onClick={() => setFiltroRol(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filtroRol === r ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border hover:border-border"}`}
          >
            {r === 'JEFE_CARRERA' ? 'Jefes de carrera' : (r || 'Todos')}
          </Button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input aria-label="Buscar por nombre"
          type="text"
          placeholder="Buscar por nombre..."
          value={filtroNombre}
          onChange={(e) => setFiltroNombre(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
        />
        <select aria-label="Carrera"
          value={filtroCarrera}
          onChange={(e) => setFiltroCarrera(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
        >
          <option value="">Todas las carreras</option>
          {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {(filtroNombre || filtroCarrera) && (
          <Button variant="ghost"
            onClick={() => { setFiltroNombre(''); setFiltroCarrera('') }}
            className="text-sm text-muted-foreground hover:text-muted-foreground px-2"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Lista móvil: desliza una fila hacia la izquierda para ver sus acciones */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:hidden">
        {usuariosFiltrados.map((u) => (
          <SwipeableRow key={u.id} actions={accionesMovil(u)} onTap={() => abrirDetalle(u)}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{u.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.numeroControl || u.username || u.email || '—'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>{u.rol}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getAccountStatus(u).className}`}>
                  {getAccountStatus(u).label}
                </span>
              </div>
            </div>
          </SwipeableRow>
        ))}
        {usuariosFiltrados.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No hay usuarios</p>
        )}
        {usuariosFiltrados.length > 0 && (
          <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
            Desliza un usuario hacia la izquierda para ver sus acciones
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-sm sm:block" tabIndex={0} role="region" aria-label="Tabla de usuarios">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Identificador</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map((u) => (
              <tr key={u.id} className="group border-b border-border transition hover:bg-background">
                <td className="px-4 py-3 font-medium text-foreground">{u.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.numeroControl || u.username || u.email || '—'}</td>
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
                    <Button variant="outline"
                      onClick={() => abrirDetalle(u)}
                      className="text-xs px-3 py-1.5 font-medium border"
                    >
                      Ver
                    </Button>

                    <Button variant="outline"
                      onClick={() => abrirEdicion(u)}
                      className="text-xs px-3 py-1.5 font-medium border"
                    >
                      Editar
                    </Button>

                      {u.rol === 'JEFE_CARRERA' && (
                      <Button variant="outline"
                        onClick={() => abrirCarreras(u)}
                        className="text-xs px-3 py-1.5 font-medium text-warning-foreground border border-warning/30"
                      >
                        Carreras
                      </Button>
                      )}

                      {u.rol === 'ALUMNO' && u.activo && !u.registroAprobado && (
                        <Button variant="outline" aria-label={puedeAprobar(u) ? 'Aprobar registro' : 'El correo aún no está verificado'}
                          onClick={() => solicitarConfirmacion(u, 'approve')}
                          disabled={!puedeAprobar(u)}
                          title={puedeAprobar(u) ? 'Aprobar registro' : 'El correo aún no está verificado'}
                          className="text-xs px-3 py-1.5 font-medium text-success-foreground border border-success/30 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Aprobar
                        </Button>
                      )}

                    {/* Desactivar/Contraseña/Eliminar: sólo aparecen con el mouse encima de la fila. */}
                    <div className="hidden items-center gap-2 group-hover:flex">
                      <Button variant="ghost"
                        onClick={() => solicitarConfirmacion(u, 'toggle')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          u.activo
                            ? "text-warning-foreground hover:bg-warning/10 border border-warning/30"
                            : "text-success-foreground hover:bg-success/10 border border-success/30"
                        }`}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </Button>

                      <Button variant="outline"
                        onClick={() => abrirPassword(u)}
                        className="text-xs px-3 py-1.5 font-medium border"
                      >
                        Contraseña
                      </Button>

                      <Button variant="destructive"
                        onClick={() => solicitarConfirmacion(u, 'delete')}
                        className="text-xs px-3 py-1.5 font-medium border"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usuariosFiltrados.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No hay usuarios</p>
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
          {formError && <p className="text-sm text-destructive-foreground">{formError}</p>}
          <Button variant="default" type="submit" className="w-full py-2.5 font-medium mt-2">
            Crear usuario
          </Button>
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
          {editModal.error && <p role="alert" className="text-sm text-destructive-foreground">{editModal.error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline"
              type="button"
              disabled={editModal.loading}
              onClick={cerrarEdicion}
              className="border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </Button>
            <Button variant="default"
              type="submit"
              disabled={editModal.loading}
              className="px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {editModal.loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false, user: null })} title="Información del usuario">
        {detailModal.user && (() => {
          const u = detailModal.user
          const rows = [
            { label: 'Nombre', value: u.nombre },
            { label: 'Rol', value: <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>{u.rol}</span> },
            { label: 'Estado', value: <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? "bg-success/10 text-success-foreground" : "bg-muted text-muted-foreground"}`}>{u.activo ? 'Activo' : 'Inactivo'}</span> },
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
            u.rol === 'ALUMNO' && {
              label: 'Grupo',
              value: u.grupo?.nombre
                ? `${u.grupo.nombre}${u.grupo.periodo ? ` · ${u.grupo.periodo}` : ''}`
                : 'Sin grupo asignado',
            },
            u.rol === 'ALUMNO' && { label: 'Semestre', value: u.semestre ?? '—' },
            u.rol === 'DOCENTE' && { label: 'Academia', value: u.academias?.length ? u.academias.map((a) => a.nombre).join(', ') : '—' },
            u.rol === 'JEFE_CARRERA' && { label: 'Carreras asignadas', value: u.carrerasJefe?.length ? u.carrerasJefe.map((item) => item.carrera.nombre).join(', ') : '—' },
            { label: 'Registro', value: new Date(u.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].filter(Boolean)

          return (
            <div className="space-y-0 divide-y divide-border">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="text-muted-foreground font-medium">{label}</span>
                  <span className="text-foreground text-right">{value}</span>
                </div>
              ))}
              <div className="space-y-3 py-4">
                <h3 className="text-sm font-semibold text-foreground">Actividad de acceso</h3>
                {authAudit.loading && <p className="text-sm text-muted-foreground">Cargando actividad...</p>}
                {authAudit.error && <p role="alert" className="text-sm text-destructive-foreground">{authAudit.error}</p>}
                {!authAudit.loading && !authAudit.error && authAudit.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
                )}
                {authAudit.items.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between">
                    <span className="font-medium text-foreground">
                      {AUTH_EVENT_LABELS[event.tipo] ?? event.tipo}
                    </span>
                    <span className="text-muted-foreground">
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
            <legend className="mb-2 text-sm font-medium text-foreground">Selecciona una o varias carreras</legend>
            {carreras.map((carrera) => (
              <label key={carrera.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-background">
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
          {formError && <p className="text-sm text-destructive-foreground">{formError}</p>}
          <Button variant="default" type="submit" disabled={!careerModal.carreraIds.length} className="w-full py-2.5 font-medium disabled:opacity-50">
            Guardar asignación
          </Button>
        </form>
      </Modal>

      {/* Modal: Cambiar contraseña de usuario */}
      <Modal open={pwModal.open} onClose={() => setPwModal({ open: false, user: null })} title={`Cambiar contraseña — ${pwModal.user?.nombre ?? ''}`}>
        <form onSubmit={cambiarPassword} className="space-y-4">
          <div>
            <label htmlFor={fieldId + '-control-839'} className="block text-xs font-medium text-foreground mb-1">Nueva contraseña</label>
            <input id={fieldId + '-control-839'}
              type="password" required minLength={8} maxLength={72}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm font-medium ${pwMsg.startsWith('¡') ? "text-success-foreground" : "text-destructive-foreground"}`}>{pwMsg}</p>
          )}
          <Button variant="default" type="submit" className="w-full py-2.5 font-medium">
            Guardar nueva contraseña
          </Button>
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
              <p className="text-sm text-foreground">
                Se eliminará definitivamente la cuenta de {confirmation.user?.nombre ?? 'este usuario'}. Esta acción no se puede deshacer.
              </p>
              <p className="text-sm text-muted-foreground">
                Se borrará también todo su historial académico: inscripciones, asistencias, calificaciones y entregas; si es docente, además sus tareas, sesiones de clase y horarios. Las materias, los grupos y las aulas se conservan.
              </p>
              <p className="text-sm text-muted-foreground">
                Si sólo quieres impedirle el acceso, usa <strong>Desactivar</strong> en su lugar.
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground">
              {confirmation.action === 'approve'
                ? `Se permitirá que ${confirmation.user?.nombre ?? 'el alumno'} inicie sesión.`
                : `${confirmation.user?.activo ? 'Se desactivará' : 'Se activará'} la cuenta de ${confirmation.user?.nombre ?? 'este usuario'}.`}
            </p>
          )}
          {confirmation.error && (
            <p role="alert" className="text-sm text-destructive-foreground">{confirmation.error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline"
              type="button"
              disabled={confirmation.loading}
              onClick={() => setConfirmation({ open: false, user: null, action: null, loading: false, error: '' })}
              className="border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </Button>
            <Button variant="ghost"
              type="button"
              disabled={confirmation.loading}
              onClick={ejecutarAccion}
              className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                confirmation.action === 'delete'
                  ? "bg-destructive/10 text-destructive-foreground hover:bg-destructive/20"
                  : "bg-primary text-primary-foreground hover:bg-primary-strong"
              }`}
            >
              {confirmation.loading
                ? 'Guardando...'
                : confirmation.action === 'delete'
                  ? 'Eliminar'
                  : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
