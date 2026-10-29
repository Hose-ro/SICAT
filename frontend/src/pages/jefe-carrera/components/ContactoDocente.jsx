import { useId, useState } from 'react'
import { ArrowUpRight, LoaderCircle, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import api from '@/api/axios'
import { actualizarJefatura } from '../supervision/actualizar'

function numeroWhatsApp(telefono) {
  const digits = String(telefono ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 13 && digits.startsWith('521')) return `52${digits.slice(3)}`
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : ''
}

export default function ContactoDocente({ docente, j }) {
  const id = useId()
  const [numero, setNumero] = useState('')
  const [guardado, setGuardado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const telefono = guardado ?? docente.telefono
  const whatsapp = numeroWhatsApp(telefono)

  const guardar = async (event) => {
    event.preventDefault()
    if (!/^\d{10}$/.test(numero)) { setError('Escribe los 10 dígitos del número.'); return }
    setEnviando(true); setError('')
    try {
      const { data } = await api.patch(`/jefe-carrera/docentes/${docente.id}/telefono`, { telefono: `+52${numero}` }, { params: { carreraId: j.carreraId, periodo: j.periodo } })
      setGuardado(data.telefono)
      actualizarJefatura(j.carreraId, j.periodo)
    } catch (e) {
      setError(e.response?.data?.message?.toString() ?? 'No se pudo guardar el número. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="docentes-contacto-panel">
      {whatsapp ? (
        <div className="docentes-telefono-registrado">
          <p className="docentes-telefono">{whatsapp.startsWith('52') && whatsapp.length === 12 ? `+52 ${whatsapp.slice(2, 5)} ${whatsapp.slice(5, 8)} ${whatsapp.slice(8)}` : `+${whatsapp}`}</p>
          <a className={`${buttonVariants({ variant: 'outline', size: 'sm' })} docentes-whatsapp`} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp con ${docente.nombre}`}>
            <MessageCircle aria-hidden="true" />Abrir WhatsApp<ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      ) : (
        <form onSubmit={guardar}>
          <label htmlFor={id} className="docentes-telefono-label">Agrega su número telefónico</label>
          <div className="docentes-telefono-fila">
            <div className="docentes-telefono-campo">
              <span aria-hidden="true">+52</span>
              <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" value={numero} maxLength={10} pattern="[0-9]{10}" required disabled={enviando || j.historico} aria-label={`Número telefónico de ${docente.nombre}, México +52`} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => { setNumero(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }} />
            </div>
            <Button type="submit" size="sm" disabled={enviando || numero.length !== 10 || j.historico}>
              {enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}Guardar número
            </Button>
          </div>
          {error && <p role="alert" id={`${id}-error`} className="mt-2 text-xs text-destructive-foreground">{error}</p>}
        </form>
      )}
    </div>
  )
}
