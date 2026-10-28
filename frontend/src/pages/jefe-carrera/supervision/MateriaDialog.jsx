import { useId, useState } from 'react'
import { LoaderCircle, Trash2 } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { semestreTexto } from './formato'
import { campoClass } from './ui'
import { mensajeError } from './useJefatura'

const SEMESTRES = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * Alta y edición de una materia de la retícula. La jefatura no asigna docente
 * aquí: el docente llega con el horario del grupo. Eliminar solo procede si la
 * materia todavía no se imparte ni tiene registros (lo valida el servidor).
 */
export default function MateriaDialog({ j, materia, semestre, onClose, onGuardada }) {
  const ids = useId()
  const nueva = !materia
  const [form, setForm] = useState({
    clave: materia?.clave ?? '',
    nombre: materia?.nombre ?? '',
    semestre: String(materia?.semestre ?? semestre ?? ''),
    numUnidades: String(materia?.numUnidades ?? 5),
    descripcion: '',
  })
  const [estado, setEstado] = useState({ enviando: false, error: '', reducir: null, confirmarBorrado: false })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const ocupado = estado.enviando

  const guardar = async (e, { forzar = false } = {}) => {
    e?.preventDefault()
    setEstado((s) => ({ ...s, enviando: true, error: '', reducir: null }))
    const datos = {
      clave: form.clave.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      semestre: form.semestre ? Number(form.semestre) : null,
    }
    try {
      if (nueva) {
        await api.post('/materias', {
          ...datos,
          semestre: datos.semestre ?? undefined,
          carreraId: Number(j.carreraId),
          numUnidades: Number(form.numUnidades),
          ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
        })
      } else {
        // Datos y unidades en una sola operación: o se guarda todo, o nada.
        await api.patch(`/materias/${materia.id}`, {
          ...datos,
          ...(Number(form.numUnidades) !== materia.numUnidades ? { numUnidades: Number(form.numUnidades), forzar } : {}),
        })
      }
      onGuardada(nueva ? 'Materia agregada a la retícula. Para impartirla falta asignarla a un grupo con docente y horario: lo registra coordinación o el docente al capturar su horario.' : 'Cambios guardados.')
    } catch (error) {
      // Reducir unidades borra lo capturado en las sobrantes: el servidor lo avisa antes de guardar nada.
      if (error.response?.data?.requiereConfirmacion && !forzar) {
        setEstado((s) => ({ ...s, enviando: false, reducir: mensajeError(error, 'Reducir unidades borra lo registrado en las que se quitan.') }))
        return
      }
      setEstado((s) => ({ ...s, enviando: false, error: mensajeError(error, 'No se pudo guardar la materia') }))
    }
  }

  const eliminar = async () => {
    setEstado((s) => ({ ...s, enviando: true, error: '' }))
    try {
      await api.delete(`/materias/${materia.id}`)
      onGuardada('Materia eliminada de la retícula.')
    } catch (error) {
      setEstado((s) => ({ ...s, enviando: false, confirmarBorrado: false, error: mensajeError(error, 'No se pudo eliminar la materia') }))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={ocupado}
      title={nueva ? 'Agregar materia' : `Editar ${materia.nombre}`}
      description={nueva ? `Se agrega a la retícula de ${j.carrera?.nombre ?? 'la carrera'}, común a todos los periodos. Para impartirla falta asignarla a un grupo con docente y horario.` : 'La retícula es común a todos los periodos: los cambios se ven en todos los grupos que la llevan, también al consultar ciclos anteriores.'}
    >
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <label htmlFor={`${ids}-clave`} className="block">
            <span className="text-xs font-medium text-muted-foreground">Clave</span>
            <input id={`${ids}-clave`} required maxLength={20} value={form.clave} onChange={set('clave')} placeholder="SCD-1021" autoComplete="off" className={cn(campoClass, 'mt-1.5 h-11 uppercase')} />
          </label>
          <label htmlFor={`${ids}-nombre`} className="block">
            <span className="text-xs font-medium text-muted-foreground">Nombre</span>
            <input id={`${ids}-nombre`} required maxLength={200} value={form.nombre} onChange={set('nombre')} autoComplete="off" className={cn(campoClass, 'mt-1.5 h-11')} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={`${ids}-semestre`} className="block">
            <span className="text-xs font-medium text-muted-foreground">Semestre en la retícula</span>
            <select id={`${ids}-semestre`} value={form.semestre} onChange={set('semestre')} className={cn(campoClass, 'mt-1.5 h-11')}>
              <option value="">Sin semestre</option>
              {SEMESTRES.map((s) => <option key={s} value={s}>{semestreTexto(s)}</option>)}
            </select>
          </label>
          <label htmlFor={`${ids}-unidades`} className="block">
            <span className="text-xs font-medium text-muted-foreground">Unidades</span>
            <input id={`${ids}-unidades`} type="number" required min={1} max={12} value={form.numUnidades} onChange={set('numUnidades')} className={cn(campoClass, 'mt-1.5 h-11 tabular-nums')} />
          </label>
        </div>
        {nueva && (
          <label htmlFor={`${ids}-descripcion`} className="block">
            <span className="text-xs font-medium text-muted-foreground">Descripción <span className="font-normal">(opcional)</span></span>
            <textarea id={`${ids}-descripcion`} rows={3} maxLength={5000} value={form.descripcion} onChange={set('descripcion')} className={cn(campoClass, 'mt-1.5 py-2.5')} />
          </label>
        )}

        {estado.error && <p role="alert" className="text-[0.8125rem] text-destructive-foreground">{estado.error}</p>}
        {estado.reducir && (
          <div role="alert" className="rounded-[var(--radius-item)] border border-warning/35 bg-warning/18 p-3 text-[0.8125rem]">
            <p className="text-foreground">{estado.reducir}</p>
            <p className="mt-1 text-xs text-muted-foreground">Todavía no se ha guardado ningún cambio. Cancelar deja la materia como estaba.</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => guardar(null, { forzar: true })}>Guardar y reducir de todos modos</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {!nueva && !materia.ofertas?.length ? (
            estado.confirmarBorrado ? (
              <span className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                ¿Eliminarla de la retícula?
                <Button type="button" variant="destructive" size="sm" onClick={eliminar} disabled={ocupado}>Sí, eliminar</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEstado((s) => ({ ...s, confirmarBorrado: false }))}>No</Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setEstado((s) => ({ ...s, confirmarBorrado: true }))} disabled={ocupado}>
                <Trash2 aria-hidden="true" /> Eliminar
              </Button>
            )
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={ocupado}>Cancelar</Button>
            <Button type="submit" disabled={ocupado}>
              {ocupado && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {nueva ? 'Agregar materia' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
