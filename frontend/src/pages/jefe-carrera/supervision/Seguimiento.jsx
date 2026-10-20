import { useId, useRef, useState } from 'react'
import { LoaderCircle, NotebookPen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { cn } from '@/lib/utils'
import { fechaCorta, fechaHoraCorta, hoyClave } from './formato'
import { Segmento } from './ui'
import { useBorrador } from './borrador'
import { claveCaso, useSeguimientos } from './useSeguimientos'

const campoClass = 'w-full rounded-[0.7rem] border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

/** Una línea con el estado del seguimiento de un caso; nada si todavía no tiene. */
export function EstadoSeguimiento({ seguimiento, className }) {
  if (!seguimiento) return null
  const ultima = seguimiento.notas.at(-1)
  if (!seguimiento.abierto) {
    return <span className={cn('text-xs text-muted-foreground', className)}>Cerrado el {fechaHoraCorta(ultima?.creadoEn)}</span>
  }
  const vencida = seguimiento.fechaRevision && seguimiento.fechaRevision <= hoyClave()
  return (
    <span className={cn('text-xs', vencida ? 'text-warning-foreground' : 'text-muted-foreground', className)}>
      Seguimiento abierto{seguimiento.fechaRevision ? ` · revisar ${seguimiento.fechaRevision === hoyClave() ? 'hoy' : fechaCorta(seguimiento.fechaRevision)}` : ''}
    </span>
  )
}

/** Historial en orden cronológico: es evidencia, no se edita ni se borra. */
export function HistorialSeguimiento({ seguimiento }) {
  if (!seguimiento?.notas.length) return null
  return (
    <ol className="divide-y divide-border border-y border-border text-[0.8125rem]">
      {seguimiento.notas.map((nota) => (
        <li key={nota.id} className="py-3">
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{nota.autor}</span>
            <time dateTime={nota.creadoEn}>{fechaHoraCorta(nota.creadoEn)}</time>
            <span>· {nota.estado === 'CERRADA' ? 'Cerró el caso' : 'Sigue abierto'}</span>
          </p>
          <p className="mt-1 whitespace-pre-line text-foreground">{nota.texto}</p>
          {nota.fechaRevision && <p className="mt-1 text-xs text-muted-foreground">Revisar el {fechaCorta(nota.fechaRevision)}</p>}
        </li>
      ))}
    </ol>
  )
}

/**
 * Nota de seguimiento sobre un caso. El borrador se conserva si el guardado
 * falla o el diálogo se cierra; en un periodo anterior solo se muestra el
 * historial. Si el historial no cargó, se dice antes de ofrecer una nota nueva.
 */
export function FormSeguimiento({ j, caso, seguimientoId, onGuardado, onCancelar }) {
  const ids = useId()
  const seguimientos = useSeguimientos({ carreraId: j.carreraId, periodo: j.periodo })
  // Un seguimiento anterior sin caso legible se ubica por su id.
  const seguimiento = seguimientoId ? seguimientos.lista.find((s) => s.id === seguimientoId) ?? null : seguimientos.buscar(caso)
  const [texto, setTexto, borrador] = useBorrador(`seguimiento:${j.carreraId}|${j.periodo}|${seguimientoId ?? claveCaso(caso)}`, '')
  const [estado, setEstado] = useState('EN_SEGUIMIENTO')
  const [revision, setRevision] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const textoRef = useRef(null)

  const guardar = async (event) => {
    event.preventDefault()
    if (texto.trim().length < 3) {
      setError('Escribe qué se acordó o revisó (mínimo 3 caracteres).')
      textoRef.current?.focus()
      return
    }
    setEnviando(true)
    setError('')
    try {
      const payload = seguimiento
        ? { alertaId: seguimiento.id }
        : { ...caso }
      const guardado = await seguimientos.registrar({
        ...payload,
        texto: texto.trim(),
        estado,
        fechaRevision: estado === 'CERRADA' || !revision ? null : revision,
      })
      setTexto('')
      borrador.limpiar()
      setRevision('')
      setAviso(estado === 'CERRADA' ? 'Caso cerrado. La nota quedó en el historial.' : 'Nota guardada en el historial.')
      onGuardado?.(guardado)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-4">
      {seguimientos.error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-item)] border border-warning/35 bg-warning/10 px-3 py-2.5 text-[0.8125rem] text-foreground">
          <span>No se pudo cargar el historial de seguimientos: puede haber notas anteriores que no se ven aquí.</span>
          <Button type="button" variant="outline" size="sm" onClick={seguimientos.reintentar}><RefreshCw aria-hidden="true" /> Reintentar</Button>
        </div>
      ) : seguimientos.cargando ? (
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Cargando historial…</p>
      ) : null}
      {seguimiento && (
        <section aria-labelledby={`${ids}-historial`}>
          <h3 id={`${ids}-historial`} className="mb-2 text-sm font-semibold text-foreground">Historial <span className="font-normal tabular-nums text-muted-foreground">{seguimiento.notas.length}</span></h3>
          <HistorialSeguimiento seguimiento={seguimiento} />
        </section>
      )}
      {j.historico ? (
        <p className="text-[0.8125rem] text-muted-foreground">Periodo anterior: el seguimiento es de solo consulta.</p>
      ) : (
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <div>
            <label htmlFor={`${ids}-texto`} className="text-xs font-medium text-muted-foreground">{seguimiento ? 'Nueva nota' : 'Nota'}</label>
            <textarea
              id={`${ids}-texto`} ref={textoRef} value={texto} rows={3} maxLength={2000}
              onChange={(e) => { setTexto(e.target.value); setAviso('') }}
              aria-invalid={Boolean(error) || undefined} aria-describedby={`${ids}-ayuda`}
              placeholder="Qué se acordó, con quién y qué sigue"
              className={cn(campoClass, 'mt-1.5 py-2.5')}
            />
            <p id={`${ids}-ayuda`} className="mt-1 text-xs text-muted-foreground">
              Queda en el historial con tu nombre y la fecha. No envía mensajes ni corrige listas o calificaciones.
              {borrador.recuperado && texto && ' Se recuperó lo que habías escrito.'}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div>
              <span aria-hidden="true" className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado del caso</span>
              <Segmento
                label="Estado del caso"
                value={estado}
                onChange={setEstado}
                options={[{ value: 'EN_SEGUIMIENTO', label: 'Sigue abierto' }, { value: 'CERRADA', label: 'Cerrar caso' }]}
              />
            </div>
            {estado !== 'CERRADA' && (
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Revisar de nuevo <span className="font-normal">(opcional)</span></span>
                <input type="date" value={revision} min={hoyClave()} onChange={(e) => setRevision(e.target.value)} className={cn(campoClass, 'mt-1.5 h-11 w-auto')} />
              </label>
            )}
          </div>
          {error && <p role="alert" className="rounded-[var(--radius-item)] border border-destructive/25 bg-destructive/5 p-3 text-[0.8125rem] text-destructive-foreground">{error}</p>}
          <p role="status" className="text-[0.8125rem] text-success-foreground empty:hidden">{aviso}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {onCancelar && <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>Cancelar</Button>}
            <Button type="submit" disabled={enviando}>
              {enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {estado === 'CERRADA' ? 'Guardar y cerrar' : 'Guardar nota'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

/** Botón «Registrar seguimiento» con su estado; abre el formulario en un diálogo. */
export function BotonSeguimiento({ j, caso, titulo, contexto, size = 'sm', className }) {
  const [abierto, setAbierto] = useState(false)
  const seguimientos = useSeguimientos({ carreraId: j.carreraId, periodo: j.periodo })
  const seguimiento = seguimientos.buscar(caso)
  if (j.historico && !seguimiento) return null
  const etiqueta = seguimiento ? (j.historico ? 'Ver seguimiento' : 'Agregar nota') : 'Registrar seguimiento'
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <Button variant="outline" size={size} onClick={() => setAbierto(true)}>
        <NotebookPen aria-hidden="true" /> {etiqueta}
      </Button>
      <EstadoSeguimiento seguimiento={seguimiento} />
      <Modal open={abierto} onClose={() => setAbierto(false)} title={titulo} description={contexto} wide>
        <FormSeguimiento j={j} caso={caso} onCancelar={() => setAbierto(false)} onGuardado={(s) => { if (!s.abierto) setAbierto(false) }} />
      </Modal>
    </span>
  )
}
