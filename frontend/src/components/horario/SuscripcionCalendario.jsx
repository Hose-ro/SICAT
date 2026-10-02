import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import Modal from '@/components/Modal'
import { notify } from '@/lib/feedback'
import { mensajeError } from '@/lib/avisos'
import { cn } from '@/lib/utils'
import api from '@/api/axios'

function urlDelFeed(token) {
  const base = new URL(api.defaults.baseURL, window.location.origin)
  return `${base.href.replace(/\/$/, '')}/calendario/${token}.ics`
}

/**
 * Suscribe el horario y las fechas límite al calendario del teléfono. El
 * enlace lleva un token propio: se muestra una sola vez y crear otro invalida
 * el anterior.
 */
export default function SuscripcionCalendario() {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(null)
  const [url, setUrl] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    api.get('/calendario/suscripcion')
      .then((res) => { if (vigente) setActivo(res.data.activo) })
      .catch(() => { if (vigente) setActivo(false) })
    return () => { vigente = false }
  }, [abierto])

  const crear = async () => {
    setOcupado(true)
    try {
      const { data } = await api.post('/calendario/suscripcion')
      setUrl(urlDelFeed(data.token))
      setActivo(true)
    } catch (error) {
      notify(mensajeError(error, 'No se pudo crear el enlace del calendario.'))
    } finally {
      setOcupado(false)
    }
  }

  const desactivar = async () => {
    setOcupado(true)
    try {
      await api.delete('/calendario/suscripcion')
      setUrl('')
      setActivo(false)
      notify('El enlace dejó de funcionar. Tu calendario ya no se actualizará.', 'success')
    } catch (error) {
      notify(mensajeError(error, 'No se pudo desactivar el enlace.'))
    } finally {
      setOcupado(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      notify('No se pudo copiar. Selecciona el enlace y cópialo a mano.')
    }
  }

  const webcal = url.replace(/^https?:/, 'webcal:')

  return (
    <>
      <Button variant="outline" type="button" onClick={() => setAbierto(true)}
        className="print-hidden inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium shadow-sm">
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Agregar a mi calendario
      </Button>

      {abierto && (
        <Modal open onClose={() => setAbierto(false)} busy={ocupado} title="Ver el horario en tu calendario"
          description="Tus clases (sin los días suspendidos) y las fechas límite de tareas aparecen en el calendario del teléfono y se actualizan solas.">
          {url ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Tu enlace</span>
                <span className="flex gap-2">
                  <input readOnly value={url} onFocus={(event) => event.target.select()}
                    className="min-w-0 flex-1 rounded-[10px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground" />
                  <Button type="button" variant="outline" onClick={copiar} className="shrink-0 gap-2">
                    {copiado ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </Button>
                </span>
              </label>
              {url.startsWith('https:') ? (
                <div className="flex flex-wrap gap-2">
                  <a href={webcal} className={cn(buttonVariants())}>Abrir en Calendario (iPhone, Mac)</a>
                  <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer"
                    className={cn(buttonVariants({ variant: 'outline' }))}>Agregar a Google Calendar</a>
                </div>
              ) : (
                // Calendario de Apple convierte webcal:// en HTTPS y Google no
                // alcanza localhost: sin HTTPS sólo funciona la descarga.
                <div className="space-y-2 rounded-[10px] border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                  <p>Este servidor no usa HTTPS, así que las apps de calendario no pueden suscribirse (pasa en desarrollo; en sicatapp.com sí funciona).</p>
                  <a href={url} download="sicat.ics" className={cn(buttonVariants({ variant: 'outline' }))}>Descargar el archivo .ics</a>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Guarda el enlace: por seguridad sólo se muestra ahora. Quien lo tenga puede ver tu horario, así que no lo compartas.
                Google Calendar puede tardar unas horas en reflejar los cambios.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {activo
                  ? 'Ya tienes un enlace activo. Si lo perdiste, crea uno nuevo; el anterior dejará de funcionar.'
                  : 'Crea un enlace privado y agrégalo a tu app de calendario una sola vez.'}
              </p>
              <Button type="button" onClick={crear} disabled={ocupado || activo === null}>
                {activo ? 'Crear enlace nuevo' : 'Crear enlace'}
              </Button>
            </div>
          )}
          {activo && (
            <div className="border-t border-border pt-3">
              <Button type="button" variant="ghost" onClick={desactivar} disabled={ocupado} className="px-2 text-destructive-foreground">
                Desactivar el enlace
              </Button>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
