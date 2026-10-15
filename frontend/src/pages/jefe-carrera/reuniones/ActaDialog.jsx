import { useId, useState } from 'react'
import { LoaderCircle, Plus, X } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fechaReunion } from '@/lib/reuniones'
import { campoClass } from '../supervision/ui'
import { mensajeError } from '../supervision/useJefatura'

const acuerdoVacio = () => ({ descripcion: '', responsable: '', fechaLimite: '' })

/**
 * Acta de la reunión: quién asistió, qué se acordó y observaciones. Se puede
 * guardar como borrador; "Finalizar" la cierra y avisa a los convocados que
 * el acta está disponible.
 */
export default function ActaDialog({ reunion, onClose, onGuardada }) {
  const ids = useId()
  // Sin asistencia previa se parte de "asistió" para marcar solo las faltas.
  const [asistencia, setAsistencia] = useState(() => Object.fromEntries(reunion.convocados.map((d) => [d.id, d.asistio ?? true])))
  const [acuerdos, setAcuerdos] = useState(() => (reunion.acuerdos.length
    ? reunion.acuerdos.map((a) => ({ descripcion: a.descripcion, responsable: a.responsable ?? '', fechaLimite: a.fechaLimite ?? '' }))
    : [acuerdoVacio()]))
  const [observaciones, setObservaciones] = useState(reunion.observaciones ?? '')
  const [estado, setEstado] = useState({ enviando: '', error: '' })
  const presentes = Object.values(asistencia).filter(Boolean).length
  const setAcuerdo = (i, k, v) => setAcuerdos((lista) => lista.map((a, n) => (n === i ? { ...a, [k]: v } : a)))

  const guardar = async (finalizar) => {
    setEstado({ enviando: finalizar ? 'finalizar' : 'borrador', error: '' })
    try {
      const { data } = await api.put(`/jefe-carrera/reuniones/${reunion.id}/acta`, {
        asistencia: Object.entries(asistencia).map(([docenteId, asistio]) => ({ docenteId: Number(docenteId), asistio })),
        acuerdos: acuerdos
          .filter((a) => a.descripcion.trim())
          .map((a) => ({ descripcion: a.descripcion.trim(), responsable: a.responsable.trim() || null, fechaLimite: a.fechaLimite || null })),
        observaciones: observaciones.trim() || null,
        finalizar,
      })
      onGuardada(data, finalizar ? 'Reunión finalizada. El acta ya está visible para los docentes.' : 'Acta guardada.')
    } catch (error) {
      setEstado({ enviando: '', error: mensajeError(error, 'No se pudo guardar el acta') })
    }
  }

  return (
    <Modal open wide onClose={onClose} busy={Boolean(estado.enviando)} title={`Acta: ${reunion.titulo}`} description={`Reunión del ${fechaReunion(reunion.fecha)}, ${reunion.horaInicio}.`}>
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Asistencia <span className="font-normal tabular-nums text-muted-foreground">{presentes} de {reunion.convocados.length}</span></legend>
        <p className="text-xs text-muted-foreground">Desmarca a quien no asistió.</p>
        <ul className="mt-2 grid max-h-56 gap-x-4 overflow-y-auto rounded-[var(--radius-item)] border border-border p-2 sm:grid-cols-2">
          {reunion.convocados.map((d) => (
            <li key={d.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[0.8125rem] hover:bg-muted">
                <input type="checkbox" checked={asistencia[d.id]} onChange={(e) => setAsistencia((a) => ({ ...a, [d.id]: e.target.checked }))} className="size-[17px] accent-primary" />
                <span className={cn('min-w-0 truncate', asistencia[d.id] ? 'text-foreground' : 'text-muted-foreground line-through')}>{d.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Acuerdos</legend>
        <ol className="mt-2 space-y-3">
          {acuerdos.map((a, i) => (
            <li key={i} className="rounded-[var(--radius-item)] border border-border p-3">
              <div className="flex items-start gap-2">
                <span className="pt-2.5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <label htmlFor={`${ids}-acuerdo-${i}`} className="sr-only">Acuerdo {i + 1}</label>
                <textarea id={`${ids}-acuerdo-${i}`} rows={2} maxLength={2000} value={a.descripcion} onChange={(e) => setAcuerdo(i, 'descripcion', e.target.value)} placeholder="Qué se acordó" className={cn(campoClass, 'min-w-0 flex-1 py-2')} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar acuerdo ${i + 1}`} onClick={() => setAcuerdos((lista) => (lista.length > 1 ? lista.filter((_, n) => n !== i) : [acuerdoVacio()]))}><X aria-hidden="true" /></Button>
              </div>
              <div className="mt-2 grid gap-2 pl-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Responsable</span>
                  <input maxLength={150} value={a.responsable} onChange={(e) => setAcuerdo(i, 'responsable', e.target.value)} className={cn(campoClass, 'mt-1 h-10')} />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Fecha límite</span>
                  <input type="date" value={a.fechaLimite} onChange={(e) => setAcuerdo(i, 'fechaLimite', e.target.value)} className={cn(campoClass, 'mt-1 h-10')} />
                </label>
              </div>
            </li>
          ))}
        </ol>
        {acuerdos.length < 50 && (
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAcuerdos((lista) => [...lista, acuerdoVacio()])}>
            <Plus aria-hidden="true" /> Agregar acuerdo
          </Button>
        )}
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">Observaciones <span className="text-xs font-normal text-muted-foreground">(opcional)</span></span>
        <textarea rows={3} maxLength={5000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={cn(campoClass, 'mt-1.5 py-2.5')} />
      </label>

      {estado.error && <p role="alert" className="text-[0.8125rem] text-destructive-foreground">{estado.error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={Boolean(estado.enviando)}>Cancelar</Button>
        <Button type="button" variant="outline" onClick={() => guardar(false)} disabled={Boolean(estado.enviando)}>
          {estado.enviando === 'borrador' && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {reunion.estado === 'FINALIZADA' ? 'Guardar cambios' : 'Guardar borrador'}
        </Button>
        {reunion.estado !== 'FINALIZADA' ? (
          <Button type="button" onClick={() => guardar(true)} disabled={Boolean(estado.enviando)}>
            {estado.enviando === 'finalizar' && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Finalizar reunión
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
