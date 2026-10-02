import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABEL, taskError } from '@/lib/tareas'

const CAMPO = 'h-10 w-full min-w-0 rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

/**
 * Borrador rápido dentro de una unidad: lo mínimo que acepta el API (título e
 * instrucciones). Adjuntos y rúbrica se agregan después en el formulario.
 */
export default function NuevaTareaRapida({ unidad, formularioCompleto, onCrear, onCancelar }) {
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('EN_LINEA')
  const [fechaLimite, setFechaLimite] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const tituloRef = useRef(null)
  const sufijo = unidad?.id ?? 'sin-unidad'

  useEffect(() => { tituloRef.current?.focus() }, [])

  const enviar = async (event) => {
    event.preventDefault()
    if (guardando) return
    if (!titulo.trim() || !instrucciones.trim()) {
      setError('Escribe el título y las instrucciones. Es lo mínimo para guardar el borrador.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      await onCrear({ titulo: titulo.trim(), instrucciones: instrucciones.trim(), tipoEntrega, fechaLimite })
    } catch (err) {
      setError(taskError(err, 'No se pudo guardar el borrador. Tus datos siguen en el formulario.'))
      setGuardando(false)
    }
  }

  return (
    <li className="border-b border-border bg-muted/50 px-4 py-4 last:border-b-0 sm:px-5">
      <form onSubmit={enviar} className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_12rem_10.5rem]" aria-label="Nueva tarea en borrador">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`borrador-titulo-${sufijo}`} className="text-[13px] font-medium text-foreground">Título</label>
          <input id={`borrador-titulo-${sufijo}`} ref={tituloRef} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160}
            placeholder="Ej. Práctica 3: servicios con systemd" className={CAMPO} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`borrador-tipo-${sufijo}`} className="text-[13px] font-medium text-foreground">Tipo de entrega</label>
          <select id={`borrador-tipo-${sufijo}`} value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)} className={CAMPO}>
            {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`borrador-fecha-${sufijo}`} className="text-[13px] font-medium text-foreground">Fecha límite</label>
          <input id={`borrador-fecha-${sufijo}`} type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className={CAMPO} />
        </div>
        <div className="flex flex-col gap-1.5 @2xl:col-span-3">
          <label htmlFor={`borrador-instrucciones-${sufijo}`} className="text-[13px] font-medium text-foreground">Instrucciones</label>
          <textarea id={`borrador-instrucciones-${sufijo}`} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} rows={2} maxLength={5000}
            placeholder="Qué deben hacer y qué deben entregar." className={cn(CAMPO, 'h-auto py-2 leading-relaxed')} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive-foreground @2xl:col-span-3">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 @2xl:col-span-3">
          <p className="text-xs text-muted-foreground">
            Queda como borrador{unidad ? ` en la Unidad ${unidad.orden}` : ''}. Para adjuntos o rúbrica usa el{' '}
            <Link to={formularioCompleto} className="font-medium text-primary-ink underline-offset-4 hover:underline">formulario completo</Link>.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" type="button" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
            <Button variant="outline" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar borrador'}</Button>
          </div>
        </div>
      </form>
    </li>
  )
}
