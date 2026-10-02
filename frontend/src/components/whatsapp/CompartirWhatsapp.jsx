import { useEffect, useState } from 'react'
import { FileText, MessageCircle, Share2 } from 'lucide-react'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import api from '@/api/axios'
import { notify } from '@/lib/feedback'
import { mensajeError } from '@/lib/avisos'
import { compartirConEnlace, compartirNativo, puedeCompartirArchivo } from '@/lib/whatsapp'
import { cerrarCompartirWhatsapp, useCompartirWhatsappStore } from '@/store/compartirWhatsappStore'

const FIELD = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40'
const FORMATOS = [{ valor: 'pdf', etiqueta: 'PDF' }, { valor: 'docx', etiqueta: 'Word' }]

function tamano(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Montado una vez en BaseLayout; se abre con `abrirCompartirWhatsapp`. */
export default function CompartirWhatsapp() {
  const config = useCompartirWhatsappStore((state) => state.config)
  if (!config) return null
  return <DialogoCompartir key={config.clave} config={config} />
}

function DialogoCompartir({ config }) {
  const { materiaId, grupoId, generarArchivo } = config
  const textoPara = (conDocumento) => (typeof config.texto === 'function' ? config.texto(conDocumento) : config.texto)

  const [adjuntar, setAdjuntar] = useState(Boolean(generarArchivo) && config.adjuntarPorDefecto !== false)
  const [texto, setTexto] = useState(() => textoPara(adjuntar))
  const [editado, setEditado] = useState(false)
  const [formato, setFormato] = useState('pdf')
  const [documento, setDocumento] = useState({ clave: null, archivo: null, error: '' })
  const [grupo, setGrupo] = useState({ cargado: !grupoId, enlace: null })
  const [editandoEnlace, setEditandoEnlace] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const clave = adjuntar ? formato : null
  const archivo = documento.clave === clave ? documento.archivo : null
  const preparando = Boolean(clave) && documento.clave !== clave

  // Se genera antes del clic: compartir y abrir ventanas exigen el gesto del usuario.
  useEffect(() => {
    if (!clave) return undefined
    let vigente = true
    generarArchivo(clave)
      .then((nuevo) => { if (vigente) setDocumento({ clave, archivo: nuevo, error: '' }) })
      .catch(() => { if (vigente) setDocumento({ clave, archivo: null, error: 'No se pudo preparar el documento. Intenta con el otro formato.' }) })
    return () => { vigente = false }
  }, [clave, generarArchivo])

  useEffect(() => {
    if (!grupoId) return
    api.get('/avisos/whatsapp', { params: { materiaId, grupoId } })
      .then((res) => {
        setGrupo({ cargado: true, enlace: res.data?.enlace ?? null })
        if (!res.data?.enlace) setEditandoEnlace(true)
      })
      .catch(() => setGrupo({ cargado: true, enlace: null }))
  }, [materiaId, grupoId])

  const alternarAdjunto = (valor) => {
    setAdjuntar(valor)
    if (!editado) setTexto(textoPara(valor))
  }

  const guardarEnlace = async (enlace) => {
    setGuardando(true)
    try {
      const { data } = await api.put('/avisos/whatsapp', { materiaId, grupoId, enlace })
      setGrupo({ cargado: true, enlace: data.enlace })
      setEditandoEnlace(!data.enlace)
      setBorrador('')
      notify(data.enlace ? 'Guardaste el grupo de WhatsApp de esta clase.' : 'Quitaste el grupo de WhatsApp.', 'success')
    } catch (error) {
      notify(mensajeError(error, 'No se pudo guardar el enlace del grupo.'))
    } finally {
      setGuardando(false)
    }
  }

  const listo = texto.trim() && !preparando && (!adjuntar || archivo)
  const nativo = Boolean(archivo) && puedeCompartirArchivo(archivo)

  const porMenuCompartir = () => {
    setEnviando(true)
    compartirNativo({ texto, archivo })
      .then((resultado) => {
        if (resultado === 'cancelado') return
        cerrarCompartirWhatsapp()
        notify('Listo. Si el mensaje no aparece en WhatsApp, ya está copiado: pégalo en el grupo.', 'success')
      })
      .catch(() => notify('El celular no dejó compartir el archivo. Usa «Descargar y abrir WhatsApp».'))
      .finally(() => setEnviando(false))
  }

  const porEnlace = () => {
    setEnviando(true)
    compartirConEnlace({ texto, archivo, enlaceGrupo: grupo.enlace })
      .then(({ destino, copiado }) => {
        if (destino === 'grupo' && !copiado) {
          notify('Se abrió el grupo, pero no se pudo copiar el mensaje. Cópialo desde aquí.')
          return
        }
        cerrarCompartirWhatsapp()
        const pasos = destino === 'grupo'
          ? archivo ? 'En el grupo, pega el mensaje y adjunta el archivo.' : 'Pégalo en el grupo.'
          : archivo ? 'Elige el grupo en WhatsApp y adjunta el archivo.' : 'Elige el grupo en WhatsApp y envía.'
        notify(`${archivo ? `Se descargó «${archivo.name}». ` : ''}${copiado ? 'Se copió el mensaje. ' : ''}${pasos}`, 'success', { duration: 9000 })
      })
      .finally(() => setEnviando(false))
  }

  const etiquetaEnlace = grupo.enlace
    ? archivo ? 'Descargar, copiar y abrir el grupo' : 'Copiar mensaje y abrir el grupo'
    : archivo ? 'Descargar y abrir WhatsApp' : 'Abrir WhatsApp'

  return (
    <Modal open onClose={cerrarCompartirWhatsapp} busy={enviando} title={config.titulo ?? 'Compartir por WhatsApp'}
      description="Mándalo al grupo de WhatsApp de la clase mientras los alumnos no usan SICAT.">
      <label className="block text-sm font-medium text-foreground">
        Mensaje
        <textarea className={`${FIELD} mt-1 font-normal`} rows={6} value={texto}
          onChange={(event) => { setTexto(event.target.value); setEditado(true) }} />
      </label>

      {generarArchivo && (
        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Instrucciones completas</legend>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4" checked={adjuntar} onChange={(event) => alternarAdjunto(event.target.checked)} />
            Adjuntar documento con las instrucciones
          </label>
          {adjuntar && (
            <>
              <div role="radiogroup" aria-label="Formato del documento" className="flex gap-2">
                {FORMATOS.map(({ valor, etiqueta }) => (
                  <Button key={valor} type="button" role="radio" aria-checked={formato === valor} size="sm"
                    variant={formato === valor ? 'default' : 'outline'} onClick={() => setFormato(valor)}>
                    {etiqueta}
                  </Button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                {preparando ? 'Preparando el documento…'
                  : archivo ? <span className="min-w-0 truncate">{archivo.name} · {tamano(archivo.size)}</span>
                    : <span className="text-destructive-foreground">{documento.error}</span>}
              </p>
            </>
          )}
        </fieldset>
      )}

      {grupoId && grupo.cargado && (
        <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
          <p className="font-medium text-foreground">Grupo de WhatsApp de la clase</p>
          {!editandoEnlace && grupo.enlace ? (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-muted-foreground">{grupo.enlace.replace('https://', '')}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setBorrador(grupo.enlace); setEditandoEnlace(true) }}>Cambiar</Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Enlace de invitación del grupo</span>
                  <input className={FIELD} inputMode="url" placeholder="https://chat.whatsapp.com/…" value={borrador}
                    onChange={(event) => setBorrador(event.target.value)} />
                </label>
                <Button type="button" variant="outline" disabled={guardando || !borrador.trim()} onClick={() => guardarEnlace(borrador)}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                En WhatsApp: abre el grupo → Info del grupo → Invitar mediante enlace → Copiar enlace. Solo se pide una vez; sin él, WhatsApp te deja elegir el chat.
              </p>
              {grupo.enlace && (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoEnlace(false)}>Cancelar</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => guardarEnlace('')}>Quitar enlace</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {nativo && (
          <Button type="button" variant="outline" disabled={!listo || enviando} onClick={porEnlace}>
            <MessageCircle aria-hidden="true" />{etiquetaEnlace}
          </Button>
        )}
        {nativo ? (
          <Button type="button" disabled={!listo || enviando} onClick={porMenuCompartir}>
            <Share2 aria-hidden="true" />Compartir en WhatsApp
          </Button>
        ) : (
          <Button type="button" disabled={!listo || enviando} onClick={porEnlace}>
            <MessageCircle aria-hidden="true" />{etiquetaEnlace}
          </Button>
        )}
      </div>
    </Modal>
  )
}
