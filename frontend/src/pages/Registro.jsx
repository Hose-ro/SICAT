import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'

export default function Registro() {
  const navigate = useNavigate()
  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState({
    nombre: '',
    numeroControl: '',
    email: '',
    telefono: '',
    password: '',
    confirmar: '',
    carreraId: '',
    semestre: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/carreras').then((r) => setCarreras(r.data))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      const data = {
        nombre: form.nombre,
        numeroControl: form.numeroControl,
        password: form.password,
        rol: 'ALUMNO',
        carreraId: form.carreraId ? parseInt(form.carreraId) : undefined,
        semestre: form.semestre ? parseInt(form.semestre) : undefined,
      }
      if (form.email) data.email = form.email
      if (form.telefono) data.telefono = form.telefono

      await api.post('/auth/register', data)
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-linear-to-br from-blue-600 to-blue-800 p-4 py-6 sm:items-center sm:py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Crear cuenta</h1>
          <p className="text-gray-500 mt-1 text-sm">Regístrate como alumno en SICAT</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Juan Pérez García"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Número de control *</label>
            <input
              required
              value={form.numeroControl}
              onChange={(e) => setForm({ ...form, numeroControl: e.target.value })}
              placeholder="225Q0103"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Carrera *</label>
              <select
                required
                value={form.carreraId}
                onChange={(e) => setForm({ ...form, carreraId: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona</option>
                {carreras.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Semestre *</label>
              <select
                required
                value={form.semestre}
                onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
                  <option key={s} value={s}>{s}°</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@ejemplo.com (opcional)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="6441234567 (opcional)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar contraseña *</label>
            <input
              required
              type="password"
              value={form.confirmar}
              onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
              placeholder="Repite tu contraseña"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 text-sm mt-1"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
