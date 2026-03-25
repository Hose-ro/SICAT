import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Layers3,
  Lock,
  Mail,
  MoonStar,
  Phone,
  SunMedium,
  User,
} from 'lucide-react'
import api from '../api/axios'
import BrandMark from '../components/branding/BrandMark'
import { getInitialDarkMode, setThemeMode } from '../lib/theme'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dark, setDark] = useState(() => getInitialDarkMode())

  useEffect(() => {
    api.get('/carreras').then((r) => setCarreras(r.data))
  }, [])

  useEffect(() => {
    setThemeMode(dark)
  }, [dark])

  const updateField = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }))
  }

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

  const labelClass = 'block text-sm font-medium text-[#223354] dark:text-[rgba(255,255,255,0.92)]'
  const inputClass = 'h-14 w-full rounded-2xl border border-[#e2e8f0] bg-[rgba(255,255,255,0.55)] px-12 pr-4 text-sm text-[#223354] outline-none transition-all duration-200 placeholder:text-[#94a3b8] hover:border-[rgba(79,124,255,0.45)] focus:border-[#4f7cff] focus:ring-4 focus:ring-[rgba(79,124,255,0.16)] dark:border-[#313c51] dark:bg-[#212d40] dark:text-[rgba(255,255,255,0.92)] dark:placeholder:text-[rgba(255,255,255,0.35)] dark:hover:border-[rgba(96,165,250,0.45)] dark:focus:border-[#60a5fa] dark:focus:ring-[rgba(96,165,250,0.14)]'
  const selectClass = `${inputClass} appearance-none`

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-linear-to-br from-[#eef2ff] via-[#e0f2fe] to-[#f1f5f9] transition-colors duration-300 dark:from-[#19212e] dark:via-[#151b25] dark:to-[#11151c]">
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[rgba(79,124,255,0.14)] blur-3xl dark:bg-[rgba(54,65,86,0.14)] sm:left-8 sm:top-8 sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute bottom-[-7rem] right-[-5rem] h-72 w-72 rounded-full bg-[rgba(140,120,255,0.10)] blur-3xl dark:bg-[rgba(44,55,75,0.12)] sm:bottom-8 sm:right-8 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(79,124,255,0.08)] blur-3xl dark:bg-[rgba(54,65,86,0.08)] sm:h-[34rem] sm:w-[34rem]" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={() => setDark((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-[#223354] shadow-[0_8px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(79,124,255,0.35)] hover:text-[#1e293b] focus:outline-none focus:ring-4 focus:ring-[rgba(79,124,255,0.15)] dark:border-[#273246] dark:bg-[#151b25]/80 dark:text-[rgba(255,255,255,0.92)] dark:hover:border-[rgba(96,165,250,0.35)] dark:hover:text-white dark:focus:ring-[rgba(96,165,250,0.14)]"
          aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-pressed={dark}
        >
          {dark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-14 lg:px-8">
        <section className="hidden lg:flex lg:flex-col lg:justify-center">
          <div className="max-w-xl space-y-8">
            <div className="inline-flex items-center gap-4">
              <BrandMark className="h-20 w-20 shrink-0 object-contain" />
              <div>
                <h1 className="text-5xl font-bold tracking-tight text-[#1e293b] dark:text-[rgba(255,255,255,0.95)]">
                  SICAT
                </h1>
                <p className="mt-1 text-base text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                  Sistema de Control de Asistencias y Tareas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-[#dbeafe] bg-white/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#4f7cff] backdrop-blur-sm dark:border-[#273246] dark:bg-[#151b25]/70 dark:text-[#60a5fa]">
                Alta de alumnos
              </span>
              <p className="max-w-lg text-lg leading-8 text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                Regístrate como alumno para consultar tus horarios, materias, asistencias y tareas
               
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/65 bg-white/55 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]">
                  Perfil
                </p>
                <p className="mt-3 text-lg font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.90)]">
                  Datos personales
                </p>
              </div>
              <div className="rounded-3xl border border-white/65 bg-white/55 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]">
                  Perfil
                </p>
                <p className="mt-3 text-lg font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.90)]">
                  Datos académicos
                </p>
              </div>
              <div className="rounded-3xl border border-white/65 bg-white/55 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]">
                  Perfil
                </p>
                <p className="mt-3 text-lg font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.90)]">
                  Acceso seguro
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-3xl lg:max-w-none">
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-4 inline-flex items-center gap-3">
                <BrandMark className="h-14 w-14 shrink-0 object-contain" />
                <div className="text-left">
                  <h1 className="text-3xl font-bold tracking-tight text-[#1e293b] dark:text-[rgba(255,255,255,0.95)]">
                    SICAT
                  </h1>
                  <p className="text-sm text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                    Registro de alumnos
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[32px] border border-[#e2e8f0] bg-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.30)]">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/45 via-transparent to-transparent dark:from-[rgba(255,255,255,0.02)]" />

              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.95)]">
                      Crear cuenta
                    </h1>
                  </div>
                  <span className="inline-flex rounded-full border border-[rgba(79,124,255,0.20)] bg-[rgba(79,124,255,0.08)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7cff] dark:border-[rgba(96,165,250,0.20)] dark:bg-[rgba(96,165,250,0.08)] dark:text-[#60a5fa]">
                    * Campos obligatorios
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="nombre" className={labelClass}>Nombre completo *</label>
                      <div className="group relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <input
                          id="nombre"
                          required
                          autoComplete="name"
                          value={form.nombre}
                          onChange={updateField('nombre')}
                          placeholder="Juan Pérez García"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="numeroControl" className={labelClass}>Número de control *</label>
                      <div className="group relative">
                        <Hash className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <input
                          id="numeroControl"
                          required
                          value={form.numeroControl}
                          onChange={updateField('numeroControl')}
                          placeholder="225Q0103"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="semestre" className={labelClass}>Semestre *</label>
                      <div className="group relative">
                        <Layers3 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <select
                          id="semestre"
                          required
                          value={form.semestre}
                          onChange={updateField('semestre')}
                          className={selectClass}
                        >
                          <option value="">Selecciona</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
                            <option key={s} value={s}>{s}°</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]" />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="carreraId" className={labelClass}>Carrera *</label>
                      <div className="group relative">
                        <BookOpen className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <select
                          id="carreraId"
                          required
                          value={form.carreraId}
                          onChange={updateField('carreraId')}
                          className={selectClass}
                        >
                          <option value="">Selecciona una carrera</option>
                          {carreras.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className={labelClass}>Correo electrónico</label>
                      <div className="group relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={updateField('email')}
                          placeholder="juan@ejemplo.com"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="telefono" className={labelClass}>Teléfono</label>
                      <div className="group relative">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <input
                          id="telefono"
                          type="tel"
                          autoComplete="tel"
                          value={form.telefono}
                          onChange={updateField('telefono')}
                          placeholder="6441234567"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="password" className={labelClass}>Contraseña *</label>
                      <div className="group relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <input
                          id="password"
                          required
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={form.password}
                          onChange={updateField('password')}
                          placeholder="Mínimo 6 caracteres"
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#4f7cff] focus:outline-none dark:text-[rgba(255,255,255,0.35)] dark:hover:text-[#60a5fa]"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="confirmar" className={labelClass}>Confirmar contraseña *</label>
                      <div className="group relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                        <input
                          id="confirmar"
                          required
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={form.confirmar}
                          onChange={updateField('confirmar')}
                          placeholder="Repite tu contraseña"
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          aria-label={showConfirm ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                          onClick={() => setShowConfirm((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#4f7cff] focus:outline-none dark:text-[rgba(255,255,255,0.35)] dark:hover:text-[#60a5fa]"
                        >
                          {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(79,124,255,0.20)] bg-[rgba(79,124,255,0.08)] p-4 dark:border-[rgba(96,165,250,0.20)] dark:bg-[rgba(96,165,250,0.08)]">
                    <div className="flex items-start gap-3">
                      <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-[#4f7cff] dark:text-[#60a5fa]" />
                      <div className="space-y-1 text-sm">
                        <p className="text-[#223354] dark:text-[rgba(255,255,255,0.92)]">
                          Usa tu <span className="font-semibold">número de control</span> y selecciona
                          correctamente carrera y semestre para ligar tu perfil académico.
                        </p>
                        <p className="text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                          Correo y teléfono son opcionales, pero ayudan a la recuperación y contacto.
                        </p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#b91c1c] dark:border-[rgba(239,68,68,0.30)] dark:bg-[rgba(239,68,68,0.12)] dark:text-[#fca5a5]"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-linear-to-r from-[#4f7cff] to-[#3f6fff] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,124,255,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(79,124,255,0.35)] focus:outline-none focus:ring-4 focus:ring-[rgba(79,124,255,0.20)] disabled:cursor-not-allowed disabled:opacity-70 dark:from-[#485265] dark:to-[#364156] dark:shadow-[0_8px_24px_rgba(72,82,101,0.25)] dark:hover:shadow-[0_12px_32px_rgba(72,82,101,0.35)] dark:focus:ring-[rgba(72,82,101,0.24)]"
                  >
                    <span className="absolute inset-0 bg-linear-to-r from-[#3f6fff] to-[#4f7cff] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:from-[#364156] dark:to-[#485265]" />
                    <span className="relative z-10">
                      {loading ? 'Registrando...' : 'Crear cuenta'}
                    </span>
                  </button>
                </form>

                <div className="mt-6 space-y-3 text-center">
                  
                  <p className="text-sm text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                    ¿Ya tienes cuenta?{' '}
                    <Link
                      to="/login"
                      className="font-medium text-[#4f7cff] transition-colors hover:text-[#3f6fff] hover:underline dark:text-[#60a5fa] dark:hover:text-[#93c5fd]"
                    >
                      Inicia sesión
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
