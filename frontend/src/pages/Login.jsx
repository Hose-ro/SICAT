import { useEffect, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, MoonStar, SunMedium, UserCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import BrandMark from '../components/branding/BrandMark'
import { saveToken } from '../lib/auth'
import { getInitialDarkMode, setThemeMode } from '../lib/theme'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [dark, setDark] = useState(() => getInitialDarkMode())
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const registered = location.state?.registered
  const redirectTo = location.state?.from || '/dashboard'

  useEffect(() => {
    setThemeMode(dark)
  }, [dark])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { identifier, password })
      const token = res.data.access_token
      saveToken(token)
      setAuth(res.data.user, token)
      navigate(redirectTo, { replace: true })
    } catch {
      setError('Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

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

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
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
                Portal académico
              </span>
              <h2 className="text-4xl font-semibold leading-tight text-[#223354] dark:text-[rgba(255,255,255,0.92)]">
                Bienvenido de vuelta al panel institucional.
              </h2>
             
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/65 bg-white/55 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]">
                  Módulo
                </p>
                <p className="mt-3 text-lg font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.90)]">
                  Asistencias
                </p>
              </div>
              <div className="rounded-3xl border border-white/65 bg-white/55 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]">
                  Módulo
                </p>
                <p className="mt-3 text-lg font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.90)]">
                  Tareas
                </p>
              </div>
              <div className="rounded-3xl border border-white/65 bg-white/55 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8] dark:text-[rgba(255,255,255,0.35)]">
                  Módulo
                </p>
                <p className="mt-3 text-lg font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.90)]">
                  Gestión escolar
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-xl lg:max-w-none">
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-4 inline-flex items-center gap-3">
                <BrandMark className="h-14 w-14 shrink-0 object-contain" />
                <div className="text-left">
                  <h1 className="text-3xl font-bold tracking-tight text-[#1e293b] dark:text-[rgba(255,255,255,0.95)]">
                    SICAT
                  </h1>
                  <p className="text-sm text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                    Sistema de Control de Asistencias y Tareas
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[32px] border border-[#e2e8f0] bg-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-[#273246] dark:bg-[#151b25]/70 dark:shadow-[0_8px_32px_rgba(0,0,0,0.30)]">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/45 via-transparent to-transparent dark:from-[rgba(255,255,255,0.02)]" />

              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="mb-8 space-y-2">
                  <h3 className="text-2xl font-semibold text-[#1e293b] dark:text-[rgba(255,255,255,0.95)]">
                    Iniciar sesión
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="identifier"
                      className="block text-sm font-medium text-[#223354] dark:text-[rgba(255,255,255,0.92)]"
                    >
                      Usuario
                    </label>
                    <div className="group relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                      <input
                        id="identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        placeholder="Correo, usuario o N° de control"
                        className="h-14 w-full rounded-2xl border border-[#e2e8f0] bg-[rgba(255,255,255,0.55)] px-12 text-sm text-[#223354] outline-none transition-all duration-200 placeholder:text-[#94a3b8] hover:border-[rgba(79,124,255,0.45)] focus:border-[#4f7cff] focus:ring-4 focus:ring-[rgba(79,124,255,0.16)] dark:border-[#313c51] dark:bg-[#212d40] dark:text-[rgba(255,255,255,0.92)] dark:placeholder:text-[rgba(255,255,255,0.35)] dark:hover:border-[rgba(96,165,250,0.45)] dark:focus:border-[#60a5fa] dark:focus:ring-[rgba(96,165,250,0.14)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-[#223354] dark:text-[rgba(255,255,255,0.92)]"
                    >
                      Contraseña
                    </label>
                    <div className="group relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#4f7cff] dark:text-[rgba(255,255,255,0.35)] dark:group-focus-within:text-[#60a5fa]" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="h-14 w-full rounded-2xl border border-[#e2e8f0] bg-[rgba(255,255,255,0.55)] px-12 pr-12 text-sm text-[#223354] outline-none transition-all duration-200 placeholder:text-[#94a3b8] hover:border-[rgba(79,124,255,0.45)] focus:border-[#4f7cff] focus:ring-4 focus:ring-[rgba(79,124,255,0.16)] dark:border-[#313c51] dark:bg-[#212d40] dark:text-[rgba(255,255,255,0.92)] dark:placeholder:text-[rgba(255,255,255,0.35)] dark:hover:border-[rgba(96,165,250,0.45)] dark:focus:border-[#60a5fa] dark:focus:ring-[rgba(96,165,250,0.14)]"
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

                  {registered && (
                    <div className="rounded-2xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.10)] px-4 py-3 text-sm text-[#166534] dark:border-[rgba(34,197,94,0.28)] dark:bg-[rgba(34,197,94,0.12)] dark:text-[#86efac]">
                      ¡Cuenta creada! Ya puedes iniciar sesión.
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#b91c1c] dark:border-[rgba(239,68,68,0.30)] dark:bg-[rgba(239,68,68,0.12)] dark:text-[#fca5a5]"
                    >
                      {error}
                    </div>
                  )}

                  <div className="rounded-2xl border border-[rgba(79,124,255,0.20)] bg-[rgba(79,124,255,0.08)] p-4 dark:border-[rgba(96,165,250,0.20)] dark:bg-[rgba(96,165,250,0.08)]">
                    <div className="flex items-start gap-3">
                      <UserCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#4f7cff] dark:text-[#60a5fa]" />
                      <div className="space-y-1 text-sm">
                        <p className="text-[#223354] dark:text-[rgba(255,255,255,0.92)]">
                          <span className="font-semibold">Alumnos:</span> ingresa con tu N° de control
                        </p>
                        <p className="text-[#223354] dark:text-[rgba(255,255,255,0.92)]">
                          <span className="font-semibold">Docentes:</span> usuario o correo
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-linear-to-r from-[#4f7cff] to-[#3f6fff] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,124,255,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(79,124,255,0.35)] focus:outline-none focus:ring-4 focus:ring-[rgba(79,124,255,0.20)] disabled:cursor-not-allowed disabled:opacity-70 dark:from-[#485265] dark:to-[#364156] dark:shadow-[0_8px_24px_rgba(72,82,101,0.25)] dark:hover:shadow-[0_12px_32px_rgba(72,82,101,0.35)] dark:focus:ring-[rgba(72,82,101,0.24)]"
                  >
                    <span className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-linear-to-r from-[#3f6fff] to-[#4f7cff] dark:from-[#364156] dark:to-[#485265]" />
                    <span className="relative z-10">
                      {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </span>
                  </button>

                  <div className="space-y-3 pt-1 text-center">
                   
                    <p className="text-sm text-[#64748b] dark:text-[rgba(255,255,255,0.50)]">
                      ¿Eres alumno nuevo?{' '}
                      <Link
                        to="/registro"
                        className="font-medium text-[#4f7cff] transition-colors hover:text-[#3f6fff] hover:underline dark:text-[#60a5fa] dark:hover:text-[#93c5fd]"
                      >
                        Crea tu cuenta aquí
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
