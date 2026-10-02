import { useEffect, useRef, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { COMENTARIOS_FRECUENTES, notaValida, parseRubrica } from '@/lib/tareas'
import { Kbd, TeclaModificadora } from './Estados'
import { Segmentado } from './Controles'

const CAMPO_NOTA = 'h-10 rounded-[10px] border border-input bg-background text-center text-base font-semibold tabular-nums text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-normal placeholder:text-muted-foreground focus:placeholder:text-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/25'

function soloNumero(valor) {
  return valor.replace(/[^0-9.]/g, '').slice(0, 5)
}

/**
 * Calificación de una entrega. Lo escrito se guarda como borrador en el padre,
 * así que cambiar de alumno y volver no lo pierde.
 */
export default function PanelCalificacion({ tarea, fila, borrador, onBorrador, onCalificar, onRevisar, onDevolver }) {
  const rubrica = tarea.tipoEvaluacion === 'RUBRICA' ? parseRubrica(tarea.rubricJson) : null
  const { entrega } = fila
  const [tipo, setTipo] = useState(borrador?.tipo ?? entrega.calificacionTipo ?? (tarea.tipoEntrega === 'FIRMA' ? 'FIRMA' : 'NUMERICA'))
  const [nota, setNota] = useState(borrador?.nota ?? (typeof entrega.calificacion === 'number' ? String(entrega.calificacion) : ''))
  const [criterios, setCriterios] = useState(() => borrador?.criterios ?? (rubrica ? rubrica.map(() => '') : []))
  const [observacion, setObservacion] = useState(borrador?.observacion ?? (fila.estado === 'ENTREGADA' ? '' : entrega.observacion ?? ''))
  const [devolviendo, setDevolviendo] = useState(false)
  const [puedeReenviar, setPuedeReenviar] = useState(true)
  const [error, setError] = useState('')
  const notaRef = useRef(null)
  const primerCriterioRef = useRef(null)
  const observacionRef = useRef(null)
  const usaRubrica = Boolean(rubrica)

  useEffect(() => {
    const destino = usaRubrica ? primerCriterioRef.current : notaRef.current
    destino?.focus({ preventScroll: true })
  }, [usaRubrica])

  const total = rubrica ? criterios.reduce((suma, valor) => suma + (Number(valor) || 0), 0) : null
  const guardarBorrador = (cambios) => onBorrador({ tipo, nota, criterios, observacion, ...cambios })

  const calificar = () => {
    setError('')
    if (rubrica) {
      if (!criterios.every((valor, i) => notaValida(valor, rubrica[i].peso, 0))) { setError('Asigna puntos a cada criterio, sin pasar del máximo.'); return }
      if (total < 1) { setError('La suma de la rúbrica debe ser al menos 1.'); return }
      onCalificar({ calificacion: total, calificacionTipo: 'NUMERICA', observacion }, { tipo, nota, criterios, observacion })
      return
    }
    if (tipo === 'NUMERICA' && !notaValida(nota)) {
      setError('Escribe una calificación entre 1 y 100.')
      notaRef.current?.focus()
      return
    }
    onCalificar({ calificacion: tipo === 'NUMERICA' ? Number(nota) : undefined, calificacionTipo: tipo, observacion }, { tipo, nota, criterios, observacion })
  }

  const devolver = () => {
    if (!observacion.trim()) {
      setError('Escribe qué debe corregir; el alumno recibirá esa observación.')
      observacionRef.current?.focus()
      return
    }
    onDevolver({ observacion, permiteCorreccion: puedeReenviar })
  }

  const agregarComentario = (texto) => {
    const valor = observacion.trim() ? `${observacion.trim()} ${texto}` : texto
    setObservacion(valor)
    guardarBorrador({ observacion: valor })
    observacionRef.current?.focus()
  }

  const onEnter = (event, accion) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      accion()
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{rubrica ? 'Rúbrica' : 'Calificación'}</h2>
        {fila.estado === 'CALIFICADA' && <span className="text-xs text-muted-foreground">Ya calificada · puedes cambiarla</span>}
      </div>

      {rubrica ? (
        <div className="mt-3 space-y-2.5">
          {rubrica.map((criterio, i) => {
            const invalido = criterios[i] !== '' && !notaValida(criterios[i], criterio.peso, 0)
            const cambiar = (valor) => {
              const siguiente = criterios.map((actual, j) => (j === i ? valor : actual))
              setCriterios(siguiente)
              guardarBorrador({ criterios: siguiente })
            }
            return (
              <div key={`${criterio.criterio}-${i}`} className="flex items-center gap-3">
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <label htmlFor={`criterio-${i}`} className="text-foreground">{criterio.criterio}</label>
                  <span id={`criterio-${i}-maximo`} className="block text-xs text-muted-foreground tabular-nums">máximo {criterio.peso}</span>
                </div>
                <button type="button" onClick={() => cambiar(String(criterio.peso))} aria-label={`Puntaje máximo en ${criterio.criterio}`}
                  className="h-8 rounded-[8px] px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
                  Máx
                </button>
                <input id={`criterio-${i}`} aria-describedby={`criterio-${i}-maximo`} ref={i === 0 ? primerCriterioRef : undefined} inputMode="decimal" autoComplete="off" placeholder="—"
                  value={criterios[i]} aria-invalid={invalido || undefined} onChange={(event) => cambiar(soloNumero(event.target.value))}
                  onKeyDown={(event) => onEnter(event, () => (i === rubrica.length - 1 ? calificar() : document.getElementById(`criterio-${i + 1}`)?.focus()))}
                  className={cn(CAMPO_NOTA, 'w-14')} />
              </div>
            )
          })}
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{total}<span className="text-sm font-normal text-muted-foreground">/100</span></span>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Segmentado label="Tipo de calificación" value={tipo} className="w-full" onChange={(valor) => { setTipo(valor); guardarBorrador({ tipo: valor }) }} options={[
            { value: 'NUMERICA', label: 'Número' },
            { value: 'REVISADO', label: 'Revisado' },
            { value: 'FIRMA', label: 'Firma' },
          ]} />
          {tipo === 'NUMERICA' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input ref={notaRef} aria-label="Calificación de 1 a 100" inputMode="decimal" autoComplete="off" placeholder="—" value={nota}
                aria-invalid={(nota !== '' && !notaValida(nota)) || undefined}
                onChange={(event) => { const valor = soloNumero(event.target.value); setNota(valor); guardarBorrador({ nota: valor }) }}
                onKeyDown={(event) => onEnter(event, calificar)} className={cn(CAMPO_NOTA, 'h-12 w-20 text-xl')} />
              {[100, 90, 80, 70].map((valor) => (
                <button key={valor} type="button" onClick={() => { setNota(String(valor)); guardarBorrador({ nota: String(valor) }); notaRef.current?.focus() }}
                  className={cn('h-9 rounded-[10px] border border-border px-2.5 text-sm font-medium tabular-nums text-foreground transition-colors duration-150 hover:bg-muted active:translate-y-px',
                    nota === String(valor) && 'border-ring/60 bg-accent')}>
                  {valor}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {tipo === 'FIRMA' ? 'Se registra la firma de la evidencia, sin número.' : 'Se registra como revisada y calificada, sin número.'}
            </p>
          )}
        </div>
      )}

      <label htmlFor="observacion-docente" className="mt-5 block text-[13px] font-medium text-foreground">Observación para el alumno</label>
      <textarea id="observacion-docente" ref={observacionRef} rows={3} value={observacion} maxLength={5000}
        onChange={(event) => { setObservacion(event.target.value); guardarBorrador({ observacion: event.target.value }) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            if (devolviendo) devolver()
            else calificar()
          }
        }}
        placeholder="Opcional al calificar; obligatoria al devolver."
        className="mt-1.5 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COMENTARIOS_FRECUENTES.map((comentario) => (
          <button key={comentario} type="button" onClick={() => agregarComentario(comentario)}
            className="h-7 rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
            {comentario}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-destructive-foreground">{error}</p>}

      {devolviendo ? (
        <div className="mt-5 rounded-[14px] border border-border p-3">
          <p className="text-sm font-medium text-foreground">Devolver para corrección</p>
          <p className="mt-0.5 text-xs text-muted-foreground">El alumno recibe tu observación como aviso.</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={puedeReenviar} onChange={(event) => setPuedeReenviar(event.target.checked)} className="size-4" />
            Puede volver a enviarla
          </label>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDevolviendo(false)}>Cancelar</Button>
            <Button variant="outline" className="flex-1" onClick={devolver}><Undo2 aria-hidden="true" />Devolver</Button>
          </div>
        </div>
      ) : (
        <>
          <Button className="mt-5 h-10 w-full" onClick={calificar}>Calificar y seguir</Button>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
            <Kbd>Enter</Kbd> en la nota · <TeclaModificadora /> <Kbd>Enter</Kbd> en la observación
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { setError(''); setDevolviendo(true) }}><Undo2 aria-hidden="true" />Devolver</Button>
            <Button variant="ghost" onClick={() => onRevisar({ observacion })}>Revisada, sin nota</Button>
          </div>
        </>
      )}
    </div>
  )
}
