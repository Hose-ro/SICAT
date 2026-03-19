import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import api from '../api/axios'

const ROL_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-700',
  DOCENTE: 'bg-blue-100 text-blue-700',
  ALUMNO: 'bg-green-100 text-green-700',
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroCarrera, setFiltroCarrera] = useState('')
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState({ open: false, user: null })
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState({
    nombre: '', email: '', username: '', numeroControl: '',
    password: '', rol: 'DOCENTE', academia: '', telefono: '',
    semestre: '', carreraId: '',
  })
  const [pwModal, setPwModal] = useState({ open: false, user: null })
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchNombre = u.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
    const matchCarrera = filtroCarrera === '' || u.carrera?.id === parseInt(filtroCarrera)
    return matchNombre && matchCarrera
  })

  const fetchUsuarios = () => {
    const q = filtroRol ? `?rol=${filtroRol}` : ''
    api.get(`/usuarios${q}`).then((r) => setUsuarios(r.data))
  }

  useEffect(() => {
    fetchUsuarios()
    api.get('/carreras').then((r) => setCarreras(r.data))
  }, [filtroRol])

  const crear = async (e) => {
    e.preventDefault()
    const data = { ...form }
    if (!data.email) delete data.email
    if (!data.username) delete data.username
    if (!data.numeroControl) delete data.numeroControl
    if (!data.academia) delete data.academia
    if (!data.telefono) delete data.telefono
    if (!data.semestre) delete data.semestre
    else data.semestre = parseInt(data.semestre)
    if (!data.carreraId) delete data.carreraId
    else data.carreraId = parseInt(data.carreraId)
    await api.post('/auth/register', data)
    setModal(false)
    setForm({ nombre: '', email: '', username: '', numeroControl: '', password: '', rol: 'DOCENTE', academia: '', telefono: '', semestre: '', carreraId: '' })
    fetchUsuarios()
  }

  const toggleActivo = async (u) => {
    const accion = u.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}?`)) return
    try {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo })
      fetchUsuarios()
    } catch (err) {
      alert(err.response?.data?.message ?? `Error al ${accion}`)
    }
  }

  const eliminar = async (u) => {
    if (!confirm(`¿Eliminar permanentemente a "${u.nombre}"?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/usuarios/${u.id}`)
      fetchUsuarios()
    } catch (err) {
      alert(err.response?.data?.message ?? 'Error al eliminar')
    }
  }

  const cambiarPassword = async (e) => {
    e.preventDefault()
    setPwMsg('')
    if (newPassword.length < 6) { setPwMsg('Mínimo 6 caracteres'); return }
    try {
      await api.patch(`/usuarios/${pwModal.user.id}`, { password: newPassword })
      setPwMsg('¡Contraseña actualizada!')
      setNewPassword('')
      setTimeout(() => setPwModal({ open: false, user: null }), 1200)
    } catch (err) {
      setPwMsg(err.response?.data?.message ?? 'Error al cambiar')
    }
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de docentes y alumnos"
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
        {['', 'ADMIN', 'DOCENTE', 'ALUMNO'].map((r) => (
          <button
            key={r}
            onClick={() => setFiltroRol(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filtroRol === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'}`}
          >
            {r || 'Todos'}
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
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {/* Ver detalle */}
                    <button
                      onClick={() => setDetailModal({ open: true, user: u })}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition"
                    >
                      Ver
                    </button>

                    {/* Toggle activar/desactivar */}
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        u.activo
                          ? 'text-orange-600 hover:bg-orange-50 border border-orange-200'
                          : 'text-green-600 hover:bg-green-50 border border-green-200'
                      }`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => eliminar(u)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-red-500 hover:bg-red-50 border border-red-200 transition"
                    >
                      Eliminar
                    </button>

                    {/* Cambiar contraseña */}
                    <button
                      onClick={() => { setPwModal({ open: true, user: u }); setNewPassword(''); setPwMsg(''); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-blue-500 hover:bg-blue-50 border border-blue-200 transition"
                    >
                      Contraseña
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rol *</label>
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DOCENTE">Docente</option>
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
              <input value={form.numeroControl} onChange={(e) => setForm({ ...form, numeroControl: e.target.value })}
                placeholder="225Q0103"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="prof.garcia"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
            <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {form.rol === 'DOCENTE' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Academia</label>
              <input value={form.academia} onChange={(e) => setForm({ ...form, academia: e.target.value })}
                placeholder="Ej: Matemáticas"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {form.rol === 'ALUMNO' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Carrera</label>
                <select value={form.carreraId} onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecciona carrera</option>
                  {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Semestre</label>
                <input type="number" min={1} max={12} value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition mt-2">
            Crear usuario
          </button>
        </form>
      </Modal>

      {/* Modal: Detalle de usuario */}
      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false, user: null })} title="Información del usuario">
        {detailModal.user && (() => {
          const u = detailModal.user
          const rows = [
            { label: 'Nombre', value: u.nombre },
            { label: 'Rol', value: <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>{u.rol}</span> },
            { label: 'Estado', value: <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span> },
            { label: 'Correo', value: u.email || '—' },
            { label: 'Username', value: u.username || '—' },
            { label: 'Núm. Control', value: u.numeroControl || '—' },
            { label: 'Teléfono', value: u.telefono || '—' },
            u.rol === 'ALUMNO' && { label: 'Carrera', value: u.carrera?.nombre || '—' },
            u.rol === 'ALUMNO' && { label: 'Semestre', value: u.semestre ?? '—' },
            u.rol === 'DOCENTE' && { label: 'Academia', value: u.academia || '—' },
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
            </div>
          )
        })()}
      </Modal>

      {/* Modal: Cambiar contraseña de usuario */}
      <Modal open={pwModal.open} onClose={() => setPwModal({ open: false, user: null })} title={`Cambiar contraseña — ${pwModal.user?.nombre ?? ''}`}>
        <form onSubmit={cambiarPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password" required minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
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
    </>
  )
}
