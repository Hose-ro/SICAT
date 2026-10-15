import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CambiarPasswordForm from '@/components/CambiarPasswordForm'
import TaskNotice from '@/components/TaskNotice'
import { confirmAction, notify } from '@/lib/feedback'
import { useAuthStore } from '@/store/authStore'

const ROL = { ADMIN: 'Administración', JEFE_CARRERA: 'Jefe de carrera', DOCENTE: 'Docente', ALUMNO: 'Alumno' }
const CAMPO = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive sm:text-sm'
const TARJETA = 'rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6'

const limpiar = (valor) => String(valor ?? '').trim()

function validar(form) {
  const errores = {}
  if (!limpiar(form.nombre)) errores.nombre = 'Escribe tu nombre.'
  if (limpiar(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpiar(form.email))) errores.email = 'Revisa el correo: falta algo como nombre@escuela.edu.mx.'
  if (limpiar(form.telefono) && !/^\d{10}$/.test(limpiar(form.telefono))) errores.telefono = 'El teléfono lleva 10 dígitos, sin espacios.'
  return errores
}

/** Lo que el sistema sabe de la persona: datos de contacto, su trabajo y su contraseña. */
export default function MiPerfil() {
  const id = useId()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const [perfil, setPerfil] = useState(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '' })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    setError('')
    api.get('/usuarios/perfil')
      .then(({ data }) => {
        if (!activo) return
        setPerfil(data)
        setForm({ nombre: data.nombre ?? '', email: data.email ?? '', telefono: data.telefono ?? '' })
      })
      .catch((err) => { if (activo) setError(err.response?.data?.message ?? 'No se pudo cargar tu perfil.') })
    return () => { activo = false }
  }, [intento])

  // El backend no deja borrar correo ni teléfono: sólo se mandan los que cambian y traen valor.
  const cambios = perfil ? Object.fromEntries(['nombre', 'email', 'telefono']
    .filter((clave) => limpiar(form[clave]) && limpiar(form[clave]) !== limpiar(perfil[clave]))
    .map((clave) => [clave, limpiar(form[clave])])) : {}
  const hayCambios = Object.keys(cambios).length > 0
  const vaciaCampoGuardado = perfil && ['email', 'telefono'].some((clave) => perfil[clave] && !limpiar(form[clave]))

  const guardar = async (event) => {
    event.preventDefault()
    const encontrados = validar(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length || !hayCambios) return
    if (cambios.email && !(await confirmAction({
      title: 'Cambiar tu correo',
      description: 'Por seguridad se cerrará tu sesión en todos tus dispositivos y tendrás que entrar de nuevo.',
      confirmLabel: 'Cambiar correo',
    }))) return
    setGuardando(true)
    try {
      const { data } = await api.patch('/usuarios/perfil', cambios)
      if (cambios.email) {
        logout()
        notify('Tu correo cambió. Entra de nuevo con tu cuenta.', 'success')
        navigate('/login', { replace: true })
        return
      }
      setPerfil((prev) => ({ ...prev, ...data }))
      setUser({ ...user, nombre: data.nombre })
      notify('Guardaste tus datos.', 'success')
    } catch (err) {
      const mensaje = err.response?.data?.message
      notify(Array.isArray(mensaje) ? mensaje.join(' ') : mensaje ?? 'No se pudieron guardar tus datos.')
    } finally {
      setGuardando(false)
    }
  }

  const campo = (clave, etiqueta, props = {}, ayuda) => (
    <div>
      <label htmlFor={`${id}-${clave}`} className="mb-1 block text-sm font-medium text-foreground">{etiqueta}</label>
      <input id={`${id}-${clave}`} value={form[clave]} className={CAMPO}
        aria-invalid={Boolean(errores[clave])}
        aria-describedby={errores[clave] ? `${id}-${clave}-error` : ayuda ? `${id}-${clave}-ayuda` : undefined}
        onChange={(event) => setForm((prev) => ({ ...prev, [clave]: event.target.value }))} {...props} />
      {errores[clave]
        ? <p id={`${id}-${clave}-error`} className="mt-1 text-xs font-medium text-destructive-foreground">{errores[clave]}</p>
        : ayuda && <p id={`${id}-${clave}-ayuda`} className="mt-1 text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  )

  if (error) return <div className="mx-auto max-w-[48rem]"><TaskNotice error={error} onRetry={() => setIntento((n) => n + 1)} /></div>

  if (!perfil) {
    return (
      <div role="status" aria-label="Cargando tu perfil" className="mx-auto max-w-[48rem] space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  }

  const identificador = perfil.numeroControl ?? perfil.username
  const academias = perfil.academias ?? []
  const carrerasJefe = (perfil.carrerasJefe ?? []).map((item) => item.carrera)

  return (
    <div className="mx-auto max-w-[48rem] space-y-6">
      <header>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Mi perfil</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {[ROL[perfil.rol] ?? perfil.rol, identificador].filter(Boolean).join(' · ')}
        </p>
      </header>

      <section aria-labelledby={`${id}-datos`} className={TARJETA}>
        <h2 id={`${id}-datos`} className="text-lg font-semibold text-foreground">Tus datos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {perfil.rol === 'DOCENTE' ? 'Así te ven tus alumnos y la escuela en listas, avisos y reportes.' : 'Así apareces en listas, avisos y reportes.'}
        </p>
        <form className="mt-5 space-y-4" onSubmit={guardar} noValidate>
          {campo('nombre', 'Nombre completo', { autoComplete: 'name', maxLength: 120, required: true })}
          {campo('email', 'Correo', { type: 'email', autoComplete: 'email', maxLength: 254 }, 'Si lo cambias, se cerrará tu sesión y entrarás de nuevo.')}
          {campo('telefono', 'Teléfono', { type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', maxLength: 10 }, '10 dígitos, sin espacios.')}
          {vaciaCampoGuardado && (
            <p className="text-xs text-muted-foreground">El correo y el teléfono no se pueden dejar vacíos: si dejas uno en blanco, se conserva el que ya tenías.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={guardando || !hayCambios}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Button>
            {!hayCambios && <span className="text-xs text-muted-foreground">Sin cambios por guardar.</span>}
          </div>
        </form>
      </section>

      {(perfil.rol === 'DOCENTE' || perfil.rol === 'JEFE_CARRERA' || perfil.rol === 'ALUMNO') && (
        <section aria-labelledby={`${id}-escuela`} className={TARJETA}>
          <h2 id={`${id}-escuela`} className="text-lg font-semibold text-foreground">En la escuela</h2>
          <p className="mt-1 text-sm text-muted-foreground">Esto lo administra la escuela; si algo está mal, pídele a coordinación que lo corrija.</p>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            {identificador && (<><dt className="text-muted-foreground">{perfil.numeroControl ? 'Número de control' : 'Usuario'}</dt><dd className="tabular-nums text-foreground">{identificador}</dd></>)}
            {perfil.carrera && (<><dt className="text-muted-foreground">Carrera</dt><dd className="text-foreground">{perfil.carrera.nombre}</dd></>)}
            {perfil.grupo && (<><dt className="text-muted-foreground">Grupo</dt><dd className="text-foreground">{perfil.grupo.nombre}{perfil.grupo.periodo ? ` · ${perfil.grupo.periodo}` : ''}</dd></>)}
            {perfil.rol === 'DOCENTE' && (<><dt className="text-muted-foreground">Academias</dt><dd className="text-foreground">{academias.length ? academias.map((item) => item.nombre).join(', ') : 'Sin academia asignada'}</dd></>)}
            {carrerasJefe.length > 0 && (<><dt className="text-muted-foreground">Carreras a tu cargo</dt><dd className="text-foreground">{carrerasJefe.map((item) => item.nombre).join(', ')}</dd></>)}
          </dl>
          {perfil.rol === 'DOCENTE' && (
            <nav aria-label="Tu trabajo" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
              <Link to="/materias" className="text-primary-ink underline-offset-4 hover:underline">Mis materias</Link>
              <Link to="/docente/grupos" className="text-primary-ink underline-offset-4 hover:underline">Mis grupos</Link>
              <Link to="/docente/horario" className="text-primary-ink underline-offset-4 hover:underline">Mi horario</Link>
            </nav>
          )}
        </section>
      )}

      <section aria-labelledby={`${id}-password`} className={TARJETA}>
        <h2 id={`${id}-password`} className="text-lg font-semibold text-foreground">Contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">Usa al menos 8 caracteres que no uses en otro sitio.</p>
        {/* En esta página la acción azul es guardar los datos. */}
        <CambiarPasswordForm className="mt-5 max-w-sm space-y-4" variant="outline" />
      </section>
    </div>
  )
}
