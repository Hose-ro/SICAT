import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, LoaderCircle } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { generarActa } from '@/lib/actaReunion'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { notify } from '@/lib/feedback'
import { fechaReunion } from '@/lib/reuniones'
import { Segmento } from '@/pages/jefe-carrera/supervision/ui'
import ActaDocumento from './ActaDocumento'

const ETIQUETA = { PDF: 'PDF', DOCX: 'Word' }
const urlDocumento = (reunion, formato) => `/reuniones/${reunion.id}/documento/${formato}`

/**
 * El acta subida, pedida con la sesión y mostrada desde memoria: el PDF en un
 * iframe y el Word convertido a HTML en el navegador.
 */
function VistaDocumento({ reunion, documento }) {
  const contenedor = useRef(null)
  const [vista, setVista] = useState({ url: null, listo: false, error: '' })

  useEffect(() => {
    let vigente = true
    let objeto = null
    api.get(urlDocumento(reunion, documento.formato), { responseType: 'blob' })
      .then(async ({ data }) => {
        if (!vigente) return
        if (documento.formato === 'PDF') {
          objeto = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
          setVista({ url: objeto, listo: true, error: '' })
          return
        }
        const { renderAsync } = await import('docx-preview')
        if (!vigente || !contenedor.current) return
        contenedor.current.innerHTML = ''
        await renderAsync(data, contenedor.current, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true })
        if (vigente) setVista({ url: null, listo: true, error: '' })
      })
      .catch(async (error) => {
        if (vigente) setVista({ url: null, listo: true, error: (await mensajeDeBlob(error.response?.data)) ?? 'No se pudo mostrar el acta.' })
      })
    return () => {
      vigente = false
      if (objeto) URL.revokeObjectURL(objeto)
    }
  }, [reunion, documento.formato, documento.createdAt])

  if (vista.error) return <p role="alert" className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-destructive-foreground">{vista.error}</p>
  return (
    <>
      {!vista.listo && <Skeleton className="h-[26rem] w-full rounded-[14px]" />}
      {documento.formato === 'PDF' ? (
        vista.url && (
          <>
            <iframe title={`Acta firmada: ${documento.nombre}`} src={vista.url} className="h-[70vh] min-h-[26rem] w-full rounded-[14px] border border-border bg-muted" />
            {/* Safari en iPhone sólo pinta la primera página dentro de un iframe. */}
            <a href={vista.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
              Abrir en otra pestaña <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </>
        )
      ) : (
        <div ref={contenedor} aria-label={`Acta firmada: ${documento.nombre}`} className="acta-docx max-h-[70vh] overflow-auto rounded-[14px] border border-border bg-muted" />
      )}
    </>
  )
}

/**
 * El acta de una reunión sin descargarla: la que arma el sistema con los
 * datos capturados y, si la jefatura la subió, la firmada (PDF y/o Word).
 * Cada una se descarga en los formatos que tenga. `detalle` pide el acta
 * completa al abrir (el docente recibe una versión resumida en la lista).
 */
export default function VisorActa({ reunion: inicial, detalle, onClose }) {
  const [reunion, setReunion] = useState(detalle ? null : inicial)
  const [error, setError] = useState('')
  const documentos = reunion?.documentos ?? inicial.documentos ?? []
  const [pestana, setPestana] = useState(() => (documentos[0]?.formato ?? 'sistema'))
  const [descargando, setDescargando] = useState('')

  useEffect(() => {
    if (!detalle) return undefined
    let vivo = true
    api.get(detalle)
      .then(({ data }) => { if (vivo) setReunion(data) })
      .catch((e) => { if (vivo) setError(e.response?.data?.message ?? 'No se pudo cargar el acta.') })
    return () => { vivo = false }
  }, [detalle])

  const documento = documentos.find((d) => d.formato === pestana)

  const descargarSistema = async (formato) => {
    setDescargando(formato)
    try {
      const archivo = await generarActa(reunion, formato)
      descargarArchivo(archivo, archivo.name)
    } catch {
      notify('No se pudo generar el acta.')
    } finally {
      setDescargando('')
    }
  }
  const descargarSubido = async (d) => {
    setDescargando(d.formato)
    try {
      const { data } = await api.get(urlDocumento(inicial, d.formato), { params: { descargar: 1 }, responseType: 'blob' })
      descargarArchivo(data, d.nombre)
    } catch (e) {
      notify((await mensajeDeBlob(e.response?.data)) ?? 'No se pudo descargar el acta.')
    } finally {
      setDescargando('')
    }
  }

  const botonDescarga = (clave, texto, accion) => (
    <Button key={clave} variant="outline" size="sm" disabled={Boolean(descargando) || !reunion} onClick={accion}>
      {descargando === clave ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} {texto}
    </Button>
  )

  return (
    <Modal open onClose={onClose} className="dialog-panel--report" title={`Acta: ${inicial.titulo}`} description={`Reunión del ${fechaReunion(inicial.fecha)}, ${inicial.horaInicio}.`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {documentos.length > 0 ? (
          <Segmento
            label="Versión del acta"
            value={pestana}
            onChange={setPestana}
            options={[
              ...documentos.map((d) => ({ value: d.formato, label: `Acta firmada · ${ETIQUETA[d.formato]}` })),
              { value: 'sistema', label: 'Acta del sistema' },
            ]}
          />
        ) : <p className="text-xs text-muted-foreground">{inicial.estado === 'FINALIZADA' ? 'Acta con los datos capturados en la reunión.' : 'Convocatoria: los acuerdos y la asistencia se llenan al capturar el acta.'}</p>}
        <div className="flex flex-wrap gap-2">
          {documento
            ? documentos.map((d) => botonDescarga(d.formato, `Descargar ${ETIQUETA[d.formato]}`, () => descargarSubido(d)))
            : [botonDescarga('pdf', 'Descargar PDF', () => descargarSistema('pdf')), botonDescarga('docx', 'Descargar Word', () => descargarSistema('docx'))]}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive-foreground">{error}</p>
      ) : !reunion ? (
        <Skeleton className="h-[26rem] w-full rounded-[14px]" />
      ) : documento ? (
        <VistaDocumento key={`${documento.formato}-${documento.createdAt}`} reunion={reunion} documento={documento} />
      ) : (
        <div className="-mx-4 bg-muted/60 px-2 py-4 sm:-mx-5 sm:px-5">
          <ActaDocumento reunion={reunion} />
        </div>
      )}
    </Modal>
  )
}
