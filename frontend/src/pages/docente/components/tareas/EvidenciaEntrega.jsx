import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FileImage, FileText, FileType } from 'lucide-react'
import api from '@/api/axios'
import SexoBadge from '@/components/SexoBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fechaHoraCorta, plazoTarea, taskFileUrl } from '@/lib/tareas'
import { Chip, EstadoEntregaChip } from './Estados'

function tipoArchivo(archivo) {
  const tipo = String(archivo.tipoArchivo || '').toUpperCase()
  if (tipo === 'PDF' || /\.pdf$/i.test(archivo.nombre)) return 'PDF'
  if (tipo === 'IMAGEN' || /\.(png|jpe?g|webp)$/i.test(archivo.nombre)) return 'IMAGEN'
  if (tipo === 'WORD' || /\.docx?$/i.test(archivo.nombre)) return 'WORD'
  return 'OTRO'
}

const ICONO = { PDF: FileText, IMAGEN: FileImage, WORD: FileType, OTRO: FileText }
const ETIQUETA = { PDF: 'PDF', IMAGEN: 'Imagen', WORD: 'Word', OTRO: 'Archivo' }

/**
 * Vista previa dentro de la página. El archivo se pide con la sesión y se
 * muestra desde memoria: el API no permite incrustarlo desde otro origen.
 */
function VistaArchivo({ archivo }) {
  const tipo = tipoArchivo(archivo)
  const previsualizable = tipo === 'PDF' || tipo === 'IMAGEN'
  const [vista, setVista] = useState({ url: null, error: false })

  useEffect(() => {
    if (!previsualizable) return undefined
    let vigente = true
    let objeto = null
    api.get(taskFileUrl(archivo.url, api.defaults.baseURL), { responseType: 'blob' })
      .then((res) => {
        if (!vigente) return
        const blob = tipo === 'PDF' ? new Blob([res.data], { type: 'application/pdf' }) : res.data
        objeto = URL.createObjectURL(blob)
        setVista({ url: objeto, error: false })
      })
      .catch(() => { if (vigente) setVista({ url: null, error: true }) })
    return () => {
      vigente = false
      if (objeto) URL.revokeObjectURL(objeto)
    }
  }, [archivo.url, previsualizable, tipo])

  if (!previsualizable || vista.error) {
    return (
      <div className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {vista.error ? 'No se pudo mostrar la vista previa.' : `Los archivos ${ETIQUETA[tipo] === 'Word' ? 'de Word' : 'de este tipo'} no tienen vista previa.`}{' '}
        <a href={taskFileUrl(archivo.url, api.defaults.baseURL)} target="_blank" rel="noreferrer" className="font-medium text-primary-ink underline-offset-4 hover:underline">
          Abrir el archivo
        </a>
      </div>
    )
  }
  if (!vista.url) return <Skeleton className="h-[26rem] w-full rounded-[14px]" />
  if (tipo === 'IMAGEN') {
    return <img src={vista.url} alt={`Evidencia: ${archivo.nombre}`} className="max-h-[70vh] w-full rounded-[14px] border border-border bg-muted object-contain" />
  }
  return <iframe title={`Vista previa de ${archivo.nombre}`} src={vista.url} className="h-[70vh] min-h-[26rem] w-full rounded-[14px] border border-border bg-muted" />
}

/** Lo que entregó el alumno: estado, comentario, archivos y su vista previa. */
export default function EvidenciaEntrega({ tarea, fila, posicion, total, onMover, mostrarVista, onMostrarVista }) {
  const { alumno, entrega, estado } = fila
  const archivos = entrega.archivos ?? []
  const [elegido, setElegido] = useState(() => archivos.find((a) => ['PDF', 'IMAGEN'].includes(tipoArchivo(a)))?.id ?? archivos[0]?.id ?? null)
  const archivo = archivos.find((a) => a.id === elegido) ?? null
  const presencial = tarea.tipoEntrega === 'PRESENCIAL'
  const p = plazoTarea(tarea)

  return (
    <section aria-label={`Entrega de ${alumno.nombre}`} className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-foreground">
            <SexoBadge sexo={alumno.sexo} /><span className="truncate">{alumno.nombre}</span>
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">No. control {alumno.numeroControl || 'sin registro'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {posicion >= 0 && <span className="mr-1 text-xs text-muted-foreground tabular-nums">{posicion + 1} de {total}</span>}
          <Button variant="outline" size="icon" aria-label="Alumno anterior" onClick={() => onMover(-1)} disabled={posicion <= 0}><ChevronUp aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" aria-label="Alumno siguiente" onClick={() => onMover(1)} disabled={posicion < 0 || posicion >= total - 1}><ChevronDown aria-hidden="true" /></Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <EstadoEntregaChip estado={estado} entrega={entrega} tarea={tarea} />
        {!entrega.esSintetica && entrega.fechaEntrega && <span className="tabular-nums">Entregó {fechaHoraCorta(entrega.fechaEntrega)}</span>}
        {entrega.fueTardia && <Chip tone="warning">Tardía</Chip>}
        {entrega.versionEntrega > 1 && <span>· Versión {entrega.versionEntrega}</span>}
      </div>

      {entrega.comentarioAlumno && (
        <div className="mt-4 rounded-[14px] bg-muted px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Comentario del alumno</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entrega.comentarioAlumno}</p>
        </div>
      )}

      {entrega.observacion && estado !== 'ENTREGADA' && (
        <div className="mt-3 rounded-[14px] border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Tu observación</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entrega.observacion}</p>
        </div>
      )}

      {archivos.length > 0 && (
        <div className="mt-5">
          <ul className="grid gap-2">
            {archivos.map((a) => {
              const tipo = tipoArchivo(a)
              const Icon = ICONO[tipo]
              const activo = mostrarVista && a.id === elegido
              return (
                <li key={a.id} className={cn('flex items-center gap-3 rounded-[12px] border border-border px-3 py-2.5', activo && 'border-ring/60 bg-accent/60')}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
                  <button type="button" onClick={() => { setElegido(a.id); onMostrarVista(true) }} aria-pressed={activo}
                    className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium text-foreground">{a.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{ETIQUETA[tipo]}{activo ? ' · en vista previa' : ''}</span>
                  </button>
                  <a href={taskFileUrl(a.url, api.defaults.baseURL)} target="_blank" rel="noreferrer" aria-label={`Abrir ${a.nombre} en otra pestaña`}
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </li>
              )
            })}
          </ul>
          {archivo && (
            <div className="mt-3">
              {mostrarVista ? (
                <>
                  <VistaArchivo key={archivo.id} archivo={archivo} />
                  <button type="button" onClick={() => onMostrarVista(false)} className="mt-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Ocultar la vista previa
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => onMostrarVista(true)} className="text-xs font-medium text-primary-ink underline-offset-4 hover:underline">
                  Mostrar la vista previa
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {entrega.esSintetica && (
        <div className="mt-5 rounded-[14px] border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            {presencial ? 'Sin registro en clase' : estado === 'NO_ENTREGADA' ? 'No entregó a tiempo' : 'Todavía no entrega'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {presencial ? 'Registra la entrega cuando la recibas en el aula.'
              : tarea.estado === 'CERRADA' ? 'La tarea está cerrada.'
                : p.texto ? (estado === 'NO_ENTREGADA' ? `El plazo terminó el ${p.texto}; aún puede entregarla como tardía.` : `Tiene hasta el ${p.texto}.`) : 'La tarea no tiene fecha límite.'}
          </p>
        </div>
      )}
      {!entrega.esSintetica && !archivos.length && !entrega.comentarioAlumno && !presencial && (
        <p className="mt-5 text-sm text-muted-foreground">La entrega no incluye archivos ni comentario.</p>
      )}
    </section>
  )
}
