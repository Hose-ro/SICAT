import { useEffect, useState } from 'react'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, MoonStar, SunMedium, UserCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/useThemeStore'
import api from '../api/axios'
import BrandMark from '../components/branding/BrandMark'
import { saveToken } from '../lib/auth'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const dark = useThemeStore((s) => s.isDark)
  const toggleDark = useThemeStore((s) => s.toggle)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const registered = location.state?.registered
  const redirectTo = location.state?.from || '/dashboard'

  useEffect(() => {
    if (searchParams.get('error') === 'google_auth_failed') {
      setError('No se pudo iniciar sesión con Google. Inténtalo nuevamente.')
    }
  }, [searchParams])

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
    <div className="relative isolate min-h-screen overflow-hidden bg-background transition-colors duration-300">
      {/* Decorative ambient blobs — glass territory, revisited in Ola 1 */}
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl sm:left-8 sm:top-8 sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute bottom-[-7rem] right-[-5rem] h-72 w-72 rounded-full bg-primary/5 blur-3xl sm:bottom-8 sm:right-8 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl sm:h-[34rem] sm:w-[34rem]" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={toggleDark}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
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
                <h1 className="text-5xl font-bold tracking-tight text-foreground">
                  SICAT
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  Sistema de Control de Asistencias y Tareas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-semibold leading-tight text-foreground">
                Bienvenido de vuelta al panel institucional.
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Módulo
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  Asistencias
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Módulo
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  Tareas
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Módulo
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
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
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    SICAT
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Sistema de Control de Asistencias y Tareas
                  </p>
                </div>
              </div>
            </div>

            {/* The one intentional glass surface (see DESIGN.md / Ola 1) */}
            <div className="relative overflow-hidden rounded-[32px] border border-border bg-card/70 shadow-lg backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-card/40 via-transparent to-transparent" />

              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="mb-8 space-y-2">
                  <h3 className="text-2xl font-semibold text-foreground">
                    Iniciar sesión
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="identifier"
                      className="block text-sm font-medium text-foreground"
                    >
                      Usuario
                    </label>
                    <div className="group relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <input
                        id="identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        placeholder="Correo, usuario o N° de control"
                        className="h-14 w-full rounded-2xl border border-input bg-background px-12 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-foreground"
                    >
                      Contraseña
                    </label>
                    <div className="group relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="h-14 w-full rounded-2xl border border-input bg-background px-12 pr-12 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {registered && (
                    <div className="rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                      ¡Cuenta creada! Ya puedes iniciar sesión.
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_var(--primary-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-strong focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="relative z-10">
                      {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </span>
                  </button>

                  <div className="relative flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">o</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <a
                    href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'}/auth/google`}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card/70 px-4 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuar con Google
                  </a>

                  <div className="space-y-3 pt-1 text-center">
                    <p className="text-sm text-muted-foreground">
                      ¿Eres alumno nuevo?{' '}
                      <Link
                        to="/registro"
                        className="font-medium text-primary transition-colors hover:text-primary-strong hover:underline"
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
