import { Button } from '@/components/ui/button'
import { useEffect, useId, useState } from 'react'
import Modal from '../../../../components/Modal'
import { useGrupoStore } from '../../../../store/grupoStore'
import SelectorModalidad from './SelectorModalidad'

/**
 * Nombre, periodo y modalidad del grupo. Lo demás (carrera, semestre) define
 * qué materias le tocan y no se cambia desde aquí. Sólo viaja lo que cambió,
 * para que el servidor no revise secciones ni nombres que siguen igual.
 */
export default function FormEditarGrupo({ open, onClose, grupo }) {
  const fieldId = useId()
  const { editarGrupo } = useGrupoStore()
  const [form, setForm] = useState({ nombre: '', periodo: '', modalidad: 'ESCOLARIZADO' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && grupo) {
      setForm({ nombre: grupo.nombre, periodo: grupo.periodo, modalidad: grupo.modalidad ?? 'ESCOLARIZADO' })
      setError('')
    }
  }, [open, grupo])

  const cambios = {}
  const nombre = form.nombre.trim().replace(/\s+/g, ' ').toUpperCase()
  if (grupo && nombre !== grupo.nombre) cambios.nombre = nombre
  if (grupo && form.periodo.trim().toUpperCase() !== grupo.periodo) cambios.periodo = form.periodo.trim().toUpperCase()
  if (grupo && form.modalidad !== (grupo.modalidad ?? 'ESCOLARIZADO')) cambios.modalidad = form.modalidad
  const hayCambios = Object.keys(cambios).length > 0

  const guardar = async (event) => {
    event.preventDefault()
    if (!hayCambios) { onClose(); return }
    setGuardando(true)
    setError('')
    try {
      await editarGrupo(grupo.id, cambios)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!grupo) return null

  return (
    <Modal open={open} onClose={onClose} title={`Editar ${grupo.nombre}`} busy={guardando}>
      <form onSubmit={guardar} className="space-y-4">
        <SelectorModalidad
          name={fieldId + '-modalidad'}
          value={form.modalidad}
          onChange={(modalidad) => setForm({ ...form, modalidad })}
          disabled={guardando}
        />
        {cambios.modalidad === 'MIXTO' && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            Al pasar a mixto, sus clases y asistencias atrasadas se regirán por el calendario mixto (sábados).
          </p>
        )}

        <div>
          <label htmlFor={fieldId + '-nombre'} className="block text-xs font-medium text-foreground mb-1">Nombre del grupo *</label>
          <input id={fieldId + '-nombre'}
            required
            maxLength={20}
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
            disabled={guardando}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {form.modalidad === 'MIXTO' ? 'Con la S antes de la letra: 103-SA, 103-SB…' : 'Por ejemplo 103-A o 103-B'}
          </p>
        </div>

        <div>
          <label htmlFor={fieldId + '-periodo'} className="block text-xs font-medium text-foreground mb-1">Periodo *</label>
          <input id={fieldId + '-periodo'}
            required
            placeholder="2026-A"
            value={form.periodo}
            onChange={(e) => setForm({ ...form, periodo: e.target.value })}
            disabled={guardando}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={guardando} className="flex-1 border py-2.5 font-medium">
            Cancelar
          </Button>
          <Button variant="default" type="submit" disabled={guardando || !hayCambios} className="flex-1 py-2.5 font-medium disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
