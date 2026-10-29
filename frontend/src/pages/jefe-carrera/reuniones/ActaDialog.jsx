import { useEffect, useId, useRef, useState } from 'react'
import { CheckCheck, FileText, LoaderCircle, Plus, Sparkles, Trash2, UploadCloud, X } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import VisorActa from '@/components/reuniones/VisorActa'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { confirmAction } from '@/lib/feedback'
import { fechaReunion } from '@/lib/reuniones'
import { generarApertura } from '@/lib/actaReunion'
import { useAuthStore } from '@/store/authStore'
import { useBorrador } from '../supervision/borrador'
import { campoClass } from '../supervision/ui'
import { mensajeError } from '../supervision/useJefatura'

const acuerdoVacio = () => ({ descripcion: '', responsable: '', fechaLimite: '' })
const seguimientoVacio = () => ({ acuerdoOrigenId: null, descripcion: '', responsable: '', fechaLimite: '', avance: '' })
const MAX_ACTA = 10 * 1024 * 1024
const ETIQUETA = { PDF: 'PDF', DOCX: 'Word' }

/**
 * El acta firmada o corregida, en PDF y/o Word. Subir otra del mismo
 * formato la reemplaza; los convocados reciben una notificación.
 */
function ActaFirmada({ reunion, onCambio }) {
  const id = useId()
  const input = useRef(null)
  const [estado, setEstado] = useState({ enviando: '', error: '', mensaje: '' })

  const subir = async (archivo) => {
    if (!archivo) return
    if (!/\.(pdf|docx)$/i.test(archivo.name)) { setEstado({ enviando: '', error: 'El acta debe ser PDF o Word (.docx).', mensaje: '' }); return }
    if (archivo.size > MAX_ACTA) { setEstado({ enviando: '', error: 'El archivo pesa más de 10 MB.', mensaje: '' }); return }
    setEstado({ enviando: 'subir', error: '', mensaje: '' })
    const datos = new FormData()
    datos.append('archivo', archivo)
    try {
      const { data } = await api.post(`/jefe-carrera/reuniones/${reunion.id}/documento`, datos)
      onCambio(data)
      setEstado({ enviando: '', error: '', mensaje: 'Acta subida. Se avisó a los convocados.' })
    } catch (error) {
      setEstado({ enviando: '', error: mensajeError(error, 'No se pudo subir el acta'), mensaje: '' })
    } finally {
      if (input.current) input.current.value = ''
    }
  }
  const quitar = async (d) => {
    const ok = await confirmAction({ title: `¿Quitar el acta en ${ETIQUETA[d.formato]}?`, description: 'Los docentes ya no podrán verla ni descargarla.', confirmLabel: 'Quitar' })
    if (!ok) return
    setEstado({ enviando: d.formato, error: '', mensaje: '' })
    try {
      const { data } = await api.delete(`/jefe-carrera/reuniones/${reunion.id}/documento/${d.formato}`)
      onCambio(data)
      setEstado({ enviando: '', error: '', mensaje: '' })
    } catch (error) {
      setEstado({ enviando: '', error: mensajeError(error, 'No se pudo quitar el acta'), mensaje: '' })
    }
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">Acta firmada</legend>
      <p className="mt-1 text-xs text-muted-foreground">Sube el acta actualizada en PDF, en Word o en ambos. Los convocados la ven en la app y la descargan en los formatos que subas.</p>
      {reunion.documentos?.length > 0 && (
        <ul className="mt-2 divide-y divide-border rounded-[var(--radius-item)] border border-border">
          {reunion.documentos.map((d) => (
            <li key={d.formato} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[0.8125rem]">
              <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate text-foreground">{d.nombre}</span><span className="shrink-0 text-xs text-muted-foreground">{ETIQUETA[d.formato]} · {(d.tamano / 1024 / 1024).toFixed(1)} MB</span></span>
              <Button type="button" variant="ghost" size="sm" disabled={Boolean(estado.enviando)} onClick={() => quitar(d)}>
                {estado.enviando === d.formato ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={id} className={cn('mt-2 flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-item)] border border-dashed border-border px-4 py-3 text-center text-[0.8125rem] text-muted-foreground hover:bg-muted/50 focus-within:ring-3 focus-within:ring-ring/40', estado.enviando === 'subir' && 'pointer-events-none opacity-60')}>
        {estado.enviando === 'subir' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <UploadCloud className="size-5" aria-hidden="true" />}
        <span className="font-medium text-foreground">{estado.enviando === 'subir' ? 'Subiendo…' : 'Elegir PDF o Word'}</span>
        <span className="text-xs">Hasta 10 MB. Si ya hay uno del mismo formato, se reemplaza.</span>
        <input ref={input} id={id} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={Boolean(estado.enviando)} onChange={(e) => subir(e.target.files?.[0])} />
      </label>
      {estado.error && <p role="alert" className="mt-2 text-xs text-destructive-foreground">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="mt-2 text-xs text-success-foreground">{estado.mensaje}</p>}
    </fieldset>
  )
}

/**
 * Acta de la reunión con los datos del formato institucional: asistencia,
 * seguimiento de acuerdos anteriores, acuerdos, hora de cierre, mesa y
 * observaciones. Se puede guardar como borrador; "Finalizar" la cierra, avisa
 * a los convocados y habilita subir el acta firmada. Lo escrito y no guardado
 * se conserva en esta pestaña aunque el diálogo se cierre.
 */
export default function ActaDialog({ reunion: inicial, onClose, onGuardada, onDocumentos }) {
  const ids = useId()
  const [reunion, setReunion] = useState(inicial)
  const [viendo, setViendo] = useState(false)
  const [finalizada, setFinalizada] = useState(false)
  const jefeId = useAuthStore((state) => state.user?.id)
  const jefeNombre = useAuthStore((state) => state.user?.nombre)
  // Sin asistencia previa cada convocado queda «sin confirmar»: nadie cuenta como presente por omisión.
  const [acta, setActa, borrador] = useBorrador(`acta:${reunion.id}`, () => ({
    asistencia: Object.fromEntries(reunion.convocados.map((d) => [d.id, d.asistio ?? null])),
    seguimiento: (reunion.seguimiento ?? []).map((a) => ({ acuerdoOrigenId: a.acuerdoOrigenId, descripcion: a.descripcion, responsable: a.responsable ?? '', fechaLimite: a.fechaLimite ?? '', avance: a.avance ?? '' })),
    acuerdos: reunion.acuerdos.length
      ? reunion.acuerdos.map((a) => ({ descripcion: a.descripcion, responsable: a.responsable ?? '', fechaLimite: a.fechaLimite ?? '' }))
      : [acuerdoVacio()],
    observaciones: reunion.observaciones ?? '',
    horaCierre: reunion.horaCierre ?? reunion.horaFin ?? '',
    apertura: reunion.apertura ?? '',
    presidenteId: reunion.presidente?.id ? String(reunion.presidente.id) : '',
    secretarioId: reunion.secretario?.id ? String(reunion.secretario.id) : '',
  }))
  const { asistencia, acuerdos, observaciones } = acta
  const seguimiento = acta.seguimiento ?? []
  const [estado, setEstado] = useState({ enviando: '', error: '' })
  const [sugerido, setSugerido] = useState(null)
  const set = (k) => (e) => setActa((a) => ({ ...a, [k]: e.target.value }))
  const setSeguimiento = (fn) => setActa((a) => ({ ...a, seguimiento: fn(a.seguimiento ?? []) }))
  const setSeg = (i, k, v) => setSeguimiento((lista) => lista.map((a, n) => (n === i ? { ...a, [k]: v } : a)))

  // Los acuerdos de la reunión anterior, para dar seguimiento a su avance.
  useEffect(() => {
    let vivo = true
    api.get(`/jefe-carrera/reuniones/${inicial.id}/seguimiento-sugerido`)
      .then(({ data }) => { if (vivo) setSugerido({ reunion: data?.reunion ?? null, acuerdos: data?.acuerdos ?? [] }) })
      .catch(() => { if (vivo) setSugerido({ reunion: null, acuerdos: [] }) })
    return () => { vivo = false }
  }, [inicial.id])
  const traerSugeridos = () => setSeguimiento((lista) => [
    ...lista.filter((a) => a.descripcion.trim()),
    ...sugerido.acuerdos
      .filter((a) => !lista.some((x) => x.acuerdoOrigenId === a.acuerdoOrigenId))
      .map((a) => ({ ...a, responsable: a.responsable ?? '', fechaLimite: a.fechaLimite ?? '', avance: '' })),
  ])
  const pendientesSugeridos = sugerido?.acuerdos.filter((a) => !seguimiento.some((x) => x.acuerdoOrigenId === a.acuerdoOrigenId)).length ?? 0
  const mesa = [
    ...(jefeId && !reunion.convocados.some((d) => d.id === jefeId) ? [{ id: jefeId, nombre: `${jefeNombre ?? 'Jefatura'} (jefatura)` }] : []),
    ...reunion.convocados,
  ]
  const enMesa = (valor) => (valor && mesa.some((d) => String(d.id) === valor) ? Number(valor) : null)
  // "Ver acta" muestra lo capturado aunque todavía no se guarde.
  const vistaPrevia = () => {
    const persona = (valor) => mesa.find((d) => d.id === enMesa(valor)) ?? null
    const registrada = Object.values(acta.asistencia).some((v) => v != null)
    return {
      ...reunion,
      convocados: reunion.convocados.map((d) => ({ ...d, asistio: acta.asistencia[d.id] ?? null })),
      asistencia: { ...reunion.asistencia, registrada },
      seguimiento: seguimiento.filter((a) => a.descripcion.trim()),
      acuerdos: acuerdos.filter((a) => a.descripcion.trim()),
      observaciones: observaciones.trim() || null,
      horaCierre: acta.horaCierre || null,
      apertura: acta.apertura?.trim() || null,
      presidente: persona(acta.presidenteId),
      secretario: persona(acta.secretarioId),
    }
  }
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
        seguimiento: seguimiento
          .filter((a) => a.descripcion.trim())
          .map((a) => ({ acuerdoOrigenId: a.acuerdoOrigenId ?? null, descripcion: a.descripcion.trim(), responsable: a.responsable.trim() || null, fechaLimite: a.fechaLimite || null, avance: a.avance.trim() || null })),
        observaciones: observaciones.trim() || null,
        horaCierre: acta.horaCierre || null,
        apertura: acta.apertura?.trim() || null,
        presidenteId: enMesa(acta.presidenteId),
        secretarioId: enMesa(acta.secretarioId),
        finalizar,
      })
      borrador.limpiar()
      if (finalizar) {
        // Se queda abierto para subir el acta firmada.
        setReunion(data)
        setFinalizada(true)
        setEstado({ enviando: '', error: '' })
        onDocumentos?.(data)
        return
      }
      onGuardada(data, 'Acta guardada.')
    } catch (error) {
      setEstado({ enviando: '', error: mensajeError(error, 'No se pudo guardar el acta') })
    }
  }

  return (
    <Modal open wide onClose={onClose} busy={Boolean(estado.enviando)} title={`Acta: ${reunion.titulo}`} description={`Reunión del ${fechaReunion(reunion.fecha)}, ${reunion.horaInicio}.`}>
      {viendo && <VisorActa reunion={vistaPrevia()} onClose={() => setViendo(false)} />}
      {finalizada && (
        <p role="status" className="rounded-[var(--radius-item)] border border-success/40 bg-success/12 px-3 py-2 text-[0.8125rem] text-success-foreground">
          Reunión finalizada. Los convocados ya pueden ver el acta; sube aquí la versión firmada cuando la tengas.
        </p>
      )}
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
        <legend className="text-sm font-semibold text-foreground">Seguimiento de acuerdos anteriores</legend>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {sugerido?.reunion
              ? `Acuerdos de la reunión del ${fechaReunion(sugerido.reunion.fecha)} (${sugerido.reunion.titulo}).`
              : sugerido ? 'No hay acuerdos de reuniones anteriores; puedes escribirlos a mano.' : 'Buscando acuerdos de la reunión anterior…'}
          </p>
          {pendientesSugeridos > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={traerSugeridos}><Plus aria-hidden="true" /> Traer {pendientesSugeridos === 1 ? '1 acuerdo' : `${pendientesSugeridos} acuerdos`}</Button>
          )}
        </div>
        {seguimiento.length > 0 && (
          <ol className="mt-2 space-y-3">
            {seguimiento.map((a, i) => (
              <li key={i} className="rounded-[var(--radius-item)] border border-border p-3">
                <div className="flex items-start gap-2">
                  <span className="pt-2.5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                  <label htmlFor={`${ids}-seg-${i}`} className="sr-only">Acuerdo anterior {i + 1}</label>
                  <textarea id={`${ids}-seg-${i}`} rows={2} maxLength={2000} value={a.descripcion} onChange={(e) => setSeg(i, 'descripcion', e.target.value)} placeholder="Acuerdo anterior" className={cn(campoClass, 'min-w-0 flex-1 py-2')} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar acuerdo anterior ${i + 1}`} onClick={() => setSeguimiento((lista) => lista.filter((_, n) => n !== i))}><X aria-hidden="true" /></Button>
                </div>
                <div className="mt-2 grid gap-2 pl-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Responsable</span>
                    <input maxLength={150} list={`${ids}-responsables`} value={a.responsable} onChange={(e) => setSeg(i, 'responsable', e.target.value)} className={cn(campoClass, 'mt-1 h-10')} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Fecha de cumplimiento</span>
                    <input type="date" value={a.fechaLimite} onChange={(e) => setSeg(i, 'fechaLimite', e.target.value)} className={cn(campoClass, 'mt-1 h-10')} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Avance</span>
                    <input maxLength={500} value={a.avance} onChange={(e) => setSeg(i, 'avance', e.target.value)} placeholder="Cumplido, en proceso, 50 %…" className={cn(campoClass, 'mt-1 h-10')} />
                  </label>
                </div>
              </li>
            ))}
          </ol>
        )}
        {seguimiento.length < 50 && (
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setSeguimiento((lista) => [...lista, seguimientoVacio()])}>
            <Plus aria-hidden="true" /> Agregar acuerdo anterior
          </Button>
        )}
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
                  <input maxLength={150} list={`${ids}-responsables`} value={a.responsable} onChange={(e) => setAcuerdo(i, 'responsable', e.target.value)} className={cn(campoClass, 'mt-1 h-10')} />
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

      <datalist id={`${ids}-responsables`}>
        {reunion.convocados.map((d) => <option key={d.id} value={d.nombre} />)}
      </datalist>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Cierre y firmas</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Hora de cierre</span>
            <input type="time" value={acta.horaCierre ?? ''} onChange={set('horaCierre')} className={cn(campoClass, 'mt-1.5 h-11')} />
          </label>
          {[['presidenteId', 'Presidente(a)'], ['secretarioId', 'Secretario(a)']].map(([campo, texto]) => (
            <label key={campo} className="block">
              <span className="text-xs font-medium text-muted-foreground">{texto}</span>
              <select value={enMesa(acta[campo]) ? acta[campo] : ''} onChange={set(campo)} className={cn(campoClass, 'mt-1.5 h-11')}>
                <option value="">Sin definir</option>
                {mesa.map((d) => <option key={d.id} value={String(d.id)}>{d.nombre}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label htmlFor={`${ids}-apertura`} className="text-xs font-medium text-muted-foreground">Apertura del acta <span className="font-normal">(opcional)</span></label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setActa((a) => ({ ...a, apertura: generarApertura(reunion) }))}><Sparkles aria-hidden="true" /> Redactar con los datos</Button>
          </div>
          <textarea id={`${ids}-apertura`} rows={3} maxLength={3000} value={acta.apertura ?? ''} onChange={set('apertura')} placeholder="Si lo dejas vacío, el acta lo redacta con la fecha, la hora y el lugar." className={cn(campoClass, 'mt-1.5 py-2.5')} />
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">Observaciones <span className="text-xs font-normal text-muted-foreground">(opcional)</span></span>
        <textarea rows={3} maxLength={5000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={cn(campoClass, 'mt-1.5 py-2.5')} />
      </label>

      {reunion.estado === 'FINALIZADA'
        ? <ActaFirmada reunion={reunion} onCambio={(data) => { setReunion(data); onDocumentos?.(data) }} />
        : <p className="text-xs text-muted-foreground">Al finalizar la reunión podrás subir aquí el acta firmada en PDF o Word.</p>}

      {estado.error && <p role="alert" className="text-[0.8125rem] text-destructive-foreground">{estado.error}</p>}
      {sinConfirmar > 0 && reunion.estado !== 'FINALIZADA' && <p id={`${ids}-pendientes`} className="text-xs text-muted-foreground">Puedes guardar el borrador con asistencia pendiente; para finalizar, confírmala completa.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" className="mr-auto" onClick={() => setViendo(true)} disabled={Boolean(estado.enviando)}><FileText aria-hidden="true" /> Ver acta</Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={Boolean(estado.enviando)}>{finalizada ? 'Cerrar' : borrador.modificado ? 'Cerrar y conservar borrador' : 'Cancelar'}</Button>
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
