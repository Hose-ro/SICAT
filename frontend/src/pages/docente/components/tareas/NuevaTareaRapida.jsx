import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { criteriosDeActividad, tipoCriterio } from '@/lib/criterios'
import { TASK_TYPE_LABEL, taskError } from '@/lib/tareas'

const CAMPO = 'h-10 w-full min-w-0 rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

/**
 * Borrador rápido dentro de una unidad: lo mínimo que acepta el API (título e
 * instrucciones). Adjuntos y rúbrica se agregan después en el formulario. Si
 * el grupo tiene criterios propios, se elige el tipo de actividad (examen,
 * práctica…) y éste propone cómo se entrega.
 */
export default function NuevaTareaRapida({ unidad, formularioCompleto, criterios, criterioInicial, onCrear, onCancelar }) {
  const opciones = criteriosDeActividad(criterios, unidad?.id)
  const conTipos = criterios?.base?.origen === 'GRUPO' && opciones.length > 0
  const inicial = criterioInicial ?? (opciones.length === 1 ? opciones[0] : null)
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [categoriaId, setCategoriaId] = useState(inicial?.id ? String(inicial.id) : '')
  const [tipoEntrega, setTipoEntrega] = useState(inicial ? tipoCriterio(inicial.tipo).entrega : 'EN_LINEA')
  const [entregaTocada, setEntregaTocada] = useState(false)
  const [fechaLimite, setFechaLimite] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const tituloRef = useRef(null)
  const sufijo = unidad?.id ?? 'sin-unidad'
  const enClase = tipoEntrega === 'PRESENCIAL'

  useEffect(() => { tituloRef.current?.focus() }, [])

  const elegirTipo = (valor) => {
    setCategoriaId(valor)
    const criterio = opciones.find((item) => String(item.id) === valor)
    // El tipo propone cómo se entrega mientras el docente no lo haya cambiado.
    if (criterio && !entregaTocada) setTipoEntrega(tipoCriterio(criterio.tipo).entrega)
  }

  const enviar = async (event) => {
    event.preventDefault()
    if (guardando) return
    if (!titulo.trim() || !instrucciones.trim()) {
      setError(enClase
        ? 'Escribe el tema y lo que abarca. Es lo mínimo para guardar el borrador.'
        : 'Escribe el título y las instrucciones. Es lo mínimo para guardar el borrador.')
      return
    }
    if (conTipos && !categoriaId) {
      setError('Elige el tipo de actividad: es el criterio con el que cuenta en la calificación.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      await onCrear({
        titulo: titulo.trim(),
        instrucciones: instrucciones.trim(),
        tipoEntrega,
        fechaLimite,
        ...(categoriaId ? { categoriaId: Number(categoriaId) } : {}),
      })
    } catch (err) {
      setError(taskError(err, 'No se pudo guardar el borrador. Tus datos siguen en el formulario.'))
      setGuardando(false)
    }
  }

  return (
    <li className="border-b border-border bg-muted/50 px-4 py-4 last:border-b-0 sm:px-5">
      <form onSubmit={enviar} className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_12rem_10.5rem]" aria-label="Nueva actividad en borrador">
        {conTipos && (
          <div className="flex flex-col gap-1.5 @2xl:col-span-3 @2xl:max-w-sm">
            <label htmlFor={`borrador-criterio-${sufijo}`} className="text-[13px] font-medium text-foreground">Tipo de actividad</label>
            <select id={`borrador-criterio-${sufijo}`} value={categoriaId} onChange={(e) => elegirTipo(e.target.value)} className={CAMPO}>
              <option value="">Elige el tipo</option>
              {opciones.map((criterio) => <option key={criterio.id} value={criterio.id}>{criterio.nombre} ({criterio.peso} %)</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`borrador-titulo-${sufijo}`} className="text-[13px] font-medium text-foreground">{enClase ? 'Tema' : 'Título'}</label>
          <input id={`borrador-titulo-${sufijo}`} ref={tituloRef} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160}
            placeholder={enClase ? 'Ej. Examen parcial 1: sistemas de archivos' : 'Ej. Práctica 3: servicios con systemd'} className={CAMPO} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`borrador-tipo-${sufijo}`} className="text-[13px] font-medium text-foreground">¿Cómo se entrega?</label>
          <select id={`borrador-tipo-${sufijo}`} value={tipoEntrega} onChange={(e) => { setTipoEntrega(e.target.value); setEntregaTocada(true) }} className={CAMPO}>
            {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`borrador-fecha-${sufijo}`} className="text-[13px] font-medium text-foreground">{enClase ? 'Fecha de aplicación' : 'Fecha límite'}</label>
          <input id={`borrador-fecha-${sufijo}`} type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className={CAMPO} />
        </div>
        <div className="flex flex-col gap-1.5 @2xl:col-span-3">
          <label htmlFor={`borrador-instrucciones-${sufijo}`} className="text-[13px] font-medium text-foreground">{enClase ? 'Temas que abarca e indicaciones' : 'Instrucciones'}</label>
          <textarea id={`borrador-instrucciones-${sufijo}`} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} rows={2} maxLength={5000}
            placeholder={enClase ? 'Temas 2.1 a 2.4. Traer calculadora; no se permiten apuntes.' : 'Qué deben hacer y qué deben entregar.'} className={cn(CAMPO, 'h-auto py-2 leading-relaxed')} />
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
