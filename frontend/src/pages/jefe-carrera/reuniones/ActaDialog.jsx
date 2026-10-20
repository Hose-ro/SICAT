import { useId, useState } from 'react'
import { CheckCheck, LoaderCircle, Plus, X } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fechaReunion } from '@/lib/reuniones'
import { useBorrador } from '../supervision/borrador'
import { campoClass } from '../supervision/ui'
import { mensajeError } from '../supervision/useJefatura'

const acuerdoVacio = () => ({ descripcion: '', responsable: '', fechaLimite: '' })

/**
 * Acta de la reunión: quién asistió, qué se acordó y observaciones. Se puede
 * guardar como borrador; "Finalizar" la cierra y avisa a los convocados que
 * el acta está disponible. Lo escrito y no guardado se conserva en esta
 * pestaña aunque el diálogo se cierre.
 */
export default function ActaDialog({ reunion, onClose, onGuardada }) {
  const ids = useId()
  // Sin asistencia previa cada convocado queda «sin confirmar»: nadie cuenta como presente por omisión.
  const [acta, setActa, borrador] = useBorrador(`acta:${reunion.id}`, () => ({
    asistencia: Object.fromEntries(reunion.convocados.map((d) => [d.id, d.asistio ?? null])),
    acuerdos: reunion.acuerdos.length
      ? reunion.acuerdos.map((a) => ({ descripcion: a.descripcion, responsable: a.responsable ?? '', fechaLimite: a.fechaLimite ?? '' }))
      : [acuerdoVacio()],
    observaciones: reunion.observaciones ?? '',
  }))
  const { asistencia, acuerdos, observaciones } = acta
  const [estado, setEstado] = useState({ enviando: '', error: '' })
  const valores = Object.values(asistencia)
  const presentes = valores.filter((v) => v === true).length
  const ausentes = valores.filter((v) => v === false).length
  const sinConfirmar = valores.filter((v) => v == null).length
  const setAsistencia = (id, asistio) => setActa((a) => ({ ...a, asistencia: { ...a.asistencia, [id]: asistio } }))
  const setAcuerdos = (fn) => setActa((a) => ({ ...a, acuerdos: fn(a.acuerdos) }))
  const setAcuerdo = (i, k, v) => setAcuerdos((lista) => lista.map((a, n) => (n === i ? { ...a, [k]: v } : a)))
  const setObservaciones = (v) => setActa((a) => ({ ...a, observaciones: v }))
  const marcarPendientes = () => setActa((a) => ({ ...a, asistencia: Object.fromEntries(Object.entries(a.asistencia).map(([id, v]) => [id, v ?? true])) }))

  const guardar = async (finalizar) => {
    if (finalizar && sinConfirmar) {
      setEstado({ enviando: '', error: `Confirma la asistencia de ${sinConfirmar === 1 ? '1 convocado' : `${sinConfirmar} convocados`} antes de finalizar.` })
      return
    }
    setEstado({ enviando: finalizar ? 'finalizar' : 'borrador', error: '' })
    try {
      const { data } = await api.put(`/jefe-carrera/reuniones/${reunion.id}/acta`, {
        // Solo se envía lo confirmado; lo pendiente sigue sin registrar.
        asistencia: Object.entries(asistencia).filter(([, asistio]) => asistio != null).map(([docenteId, asistio]) => ({ docenteId: Number(docenteId), asistio })),
        acuerdos: acuerdos
          .filter((a) => a.descripcion.trim())
          .map((a) => ({ descripcion: a.descripcion.trim(), responsable: a.responsable.trim() || null, fechaLimite: a.fechaLimite || null })),
        observaciones: observaciones.trim() || null,
        finalizar,
      })
      borrador.limpiar()
      onGuardada(data, finalizar ? 'Reunión finalizada. El acta ya está visible para los docentes.' : 'Acta guardada.')
    } catch (error) {
      setEstado({ enviando: '', error: mensajeError(error, 'No se pudo guardar el acta') })
    }
  }

  return (
    <Modal open wide onClose={onClose} busy={Boolean(estado.enviando)} title={`Acta: ${reunion.titulo}`} description={`Reunión del ${fechaReunion(reunion.fecha)}, ${reunion.horaInicio}.`}>
      {borrador.recuperado && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-item)] border border-border bg-muted px-3 py-2 text-xs text-foreground">
          Se recuperó un borrador sin guardar de esta acta.
          <Button type="button" variant="ghost" size="sm" onClick={borrador.descartar}>Descartar borrador</Button>
        </p>
      )}
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">
          Asistencia <span className="font-normal tabular-nums text-muted-foreground">{presentes} {presentes === 1 ? 'asistió' : 'asistieron'} · {ausentes} {ausentes === 1 ? 'faltó' : 'faltaron'}{sinConfirmar ? ` · ${sinConfirmar} sin confirmar` : ''}</span>
        </legend>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Marca a cada convocado. Para finalizar no puede quedar nadie sin confirmar.</p>
          {sinConfirmar > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={marcarPendientes}>
              <CheckCheck aria-hidden="true" /> Marcar {sinConfirmar === 1 ? 'al pendiente' : `a los ${sinConfirmar} pendientes`} como presentes
            </Button>
          )}
        </div>
        <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-[var(--radius-item)] border border-border">
          {reunion.convocados.map((d) => {
            const valor = asistencia[d.id]
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[0.8125rem]">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {d.nombre}
                  {valor == null && <span className="ml-2 text-xs text-warning-foreground">Sin confirmar</span>}
                </span>
                <span role="group" aria-label={`Asistencia de ${d.nombre}`} className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
                  {[[true, 'Asistió'], [false, 'Faltó']].map(([opcion, texto]) => (
                    <button
                      key={texto}
                      type="button"
                      aria-pressed={valor === opcion}
                      onClick={() => setAsistencia(d.id, valor === opcion ? null : opcion)}
                      className="min-h-9 rounded-md border border-transparent px-3 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-border aria-pressed:bg-card aria-pressed:font-medium aria-pressed:text-foreground max-md:min-h-11"
                    >
                      {texto}
                    </button>
                  ))}
                </span>
              </li>
            )
          })}
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
      {sinConfirmar > 0 && reunion.estado !== 'FINALIZADA' && <p id={`${ids}-pendientes`} className="text-xs text-muted-foreground">Puedes guardar el borrador con asistencia pendiente; para finalizar, confírmala completa.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={Boolean(estado.enviando)}>{borrador.modificado ? 'Cerrar y conservar borrador' : 'Cancelar'}</Button>
        <Button type="button" variant="outline" onClick={() => guardar(false)} disabled={Boolean(estado.enviando)}>
          {estado.enviando === 'borrador' && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {reunion.estado === 'FINALIZADA' ? 'Guardar cambios' : 'Guardar borrador'}
        </Button>
        {reunion.estado !== 'FINALIZADA' ? (
          <Button type="button" onClick={() => guardar(true)} disabled={Boolean(estado.enviando)} aria-describedby={sinConfirmar ? `${ids}-pendientes` : undefined}>
            {estado.enviando === 'finalizar' && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Finalizar reunión
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
