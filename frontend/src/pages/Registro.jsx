import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
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
import { saveToken } from '../lib/auth'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/useThemeStore'

export default function Registro() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()

  // Datos que vienen de Google cuando el usuario es nuevo
  const pendingToken = searchParams.get('pending_token') ?? ''
  const googleNombre = searchParams.get('google_nombre') ?? ''
  const googleEmail = searchParams.get('google_email') ?? ''
  const isGoogleFlow = Boolean(pendingToken)

  const [carreras, setCarreras] = useState([])
  const [form, setForm] = useState({
    nombre: googleNombre,
    numeroControl: '',
    email: googleEmail,
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
  const dark = useThemeStore((s) => s.isDark)
  const toggleDark = useThemeStore((s) => s.toggle)

  useEffect(() => {
    api.get('/carreras').then((r) => setCarreras(r.data))
  }, [])

  // Sincroniza datos de Google si el componente se monta con params
  useEffect(() => {
    if (isGoogleFlow) {
      setForm((f) => ({
        ...f,
        nombre: googleNombre || f.nombre,
        email: googleEmail || f.email,
      }))
    }
  }, [isGoogleFlow, googleNombre, googleEmail])

  const updateField = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isGoogleFlow) {
      if (form.password !== form.confirmar) {
        setError('Las contraseñas no coinciden')
        return
      }
      if (form.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres')
        return
      }
    }

    setLoading(true)
    try {
      const data = {
        nombre: form.nombre,
        numeroControl: form.numeroControl,
        carreraId: form.carreraId ? parseInt(form.carreraId) : undefined,
        semestre: form.semestre ? parseInt(form.semestre) : undefined,
      }
      if (form.email) data.email = form.email
      if (form.telefono) data.telefono = form.telefono
      if (!isGoogleFlow) data.password = form.password
      if (isGoogleFlow) data.pendingGoogleToken = pendingToken

      const res = await api.post('/auth/register', data)

      if (isGoogleFlow && res.data?.access_token) {
        // Registro con Google: auto-login directo
        saveToken(res.data.access_token)
        setAuth(res.data.user, res.data.access_token)
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/login', { state: { registered: true } })
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  const labelClass = 'block text-sm font-medium text-foreground'
  const inputClass = 'h-14 w-full rounded-2xl border border-input bg-background px-12 pr-4 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'
  const iconClass = 'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary'
  const selectClass = `${inputClass} appearance-none`

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background transition-colors duration-300">
      {/* Decorative ambient blobs */}
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl sm:left-8 sm:top-8 sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute bottom-[-7rem] right-[-5rem] h-72 w-72 rounded-full bg-primary/5 blur-3xl sm:bottom-8 sm:right-8 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl sm:h-[34rem] sm:w-[34rem]" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={toggleDark}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
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
                <h1 className="text-5xl font-bold tracking-tight text-foreground">
                  SICAT
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  Sistema de Control de Asistencias y Tareas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Alta de alumnos
              </span>
              <p className="max-w-lg text-lg leading-8 text-muted-foreground">
                Regístrate como alumno para consultar tus horarios, materias, asistencias y tareas
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Perfil
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  Datos personales
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Perfil
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  Datos académicos
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Perfil
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
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
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    SICAT
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Registro de alumnos
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-lg">
              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-foreground">
                      Crear cuenta
                    </h1>
                  </div>
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    * Campos obligatorios
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {isGoogleFlow && (
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-4 py-3">
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      <p className="text-sm text-foreground">
                        Completa tu perfil académico para vincular tu cuenta de Google.
                        <span className="ml-1 text-muted-foreground">No necesitas crear contraseña.</span>
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="nombre" className={labelClass}>Nombre completo *</label>
                      <div className="group relative">
                        <User className={iconClass} />
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
                        <Hash className={iconClass} />
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
                        <Layers3 className={iconClass} />
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
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="carreraId" className={labelClass}>Carrera *</label>
                      <div className="group relative">
                        <BookOpen className={iconClass} />
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
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className={labelClass}>Correo electrónico</label>
                      <div className="group relative">
                        <Mail className={iconClass} />
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
                        <Phone className={iconClass} />
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

                    {!isGoogleFlow && (
                      <div className="space-y-2">
                        <label htmlFor="password" className={labelClass}>Contraseña *</label>
                        <div className="group relative">
                          <Lock className={iconClass} />
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
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary focus:outline-none"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isGoogleFlow && (
                      <div className="space-y-2">
                        <label htmlFor="confirmar" className={labelClass}>Confirmar contraseña *</label>
                        <div className="group relative">
                          <Lock className={iconClass} />
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
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary focus:outline-none"
                          >
                            {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-start gap-3">
                      <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          Usa tu <span className="font-semibold">número de control</span> y selecciona
                          correctamente carrera y semestre para ligar tu perfil académico.
                        </p>
                        <p className="text-muted-foreground">
                          Correo y teléfono son opcionales, pero ayudan a la recuperación y contacto.
                        </p>
                      </div>
                    </div>
                  </div>

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
                      {loading ? 'Registrando...' : 'Crear cuenta'}
                    </span>
                  </button>
                </form>

                <div className="mt-6 space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    ¿Ya tienes cuenta?{' '}
                    <Link
                      to="/login"
                      className="font-medium text-primary transition-colors hover:text-primary-strong hover:underline"
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
