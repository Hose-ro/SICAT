import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import api from '@/api/axios'

const CAMPO = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm'

/** Formulario para cambiar la contraseña propia; lo usan el menú y Mi perfil. */
export default function CambiarPasswordForm({ inputRef, onListo, className, variant = 'default' }) {
  const id = useId()
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (event) => {
    event.preventDefault()
    setError('')
    setExito('')
    if (form.newPw.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return }
    if (form.newPw !== form.confirm) { setError('Las contraseñas no coinciden'); return }
    setGuardando(true)
    try {
      await api.post('/auth/change-password', { currentPassword: form.current, newPassword: form.newPw })
      setExito('¡Contraseña actualizada!')
      setForm({ current: '', newPw: '', confirm: '' })
      onListo?.()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Error al cambiar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  const campo = (clave, etiqueta, autoComplete, extra = {}) => (
    <div>
      <label htmlFor={`${id}-${clave}`} className="mb-1 block text-xs font-medium text-foreground">{etiqueta}</label>
      <input id={`${id}-${clave}`} type="password" required maxLength={72} autoComplete={autoComplete}
        value={form[clave]} onChange={(event) => setForm({ ...form, [clave]: event.target.value })}
        className={CAMPO} {...extra} />
    </div>
  )

  return (
    <form className={className ?? 'space-y-4'} onSubmit={enviar}
      aria-describedby={error ? `${id}-error` : exito ? `${id}-exito` : undefined}>
      {campo('current', 'Contraseña actual', 'current-password', { ref: inputRef })}
      {campo('newPw', 'Nueva contraseña', 'new-password', { minLength: 8 })}
      {campo('confirm', 'Confirmar nueva contraseña', 'new-password', { minLength: 8 })}
      {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive-foreground">{error}</p>}
      {exito && <p id={`${id}-exito`} role="status" className="text-sm font-medium text-success-foreground">{exito}</p>}
      <Button type="submit" variant={variant} disabled={guardando} className="w-full py-2.5 font-medium">
        {guardando ? 'Guardando...' : 'Actualizar contraseña'}
      </Button>
    </form>
  )
}
