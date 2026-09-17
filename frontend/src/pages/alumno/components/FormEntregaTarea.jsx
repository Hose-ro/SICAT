import { Button } from '@/components/ui/button'
import { useMemo, useState } from 'react'
import { FileBadge2, UploadCloud } from 'lucide-react'
import api from '../../../api/axios'
import { useTareaStore } from '../../../store/tareaStore'

import TaskNotice from '../../../components/TaskNotice'
import { mergeTaskFiles, taskError, deliveryHelp, taskFileUrl } from '../../../lib/tareas'

function getAcceptByTaskType(tipoEntrega) {
  if (tipoEntrega === 'FIRMA') return '.png,.jpg,.jpeg,.webp'
  return '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp'
}

export default function FormEntregaTarea({ tarea, miEntrega, puedeEditar, onSuccess }) {
  const { entregar, editarMiEntrega } = useTareaStore()
  const [comentario, setComentario] = useState(miEntrega?.comentarioAlumno || '')
  const [archivos, setArchivos] = useState([])
  const [removeIds, setRemoveIds] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const existingFiles = miEntrega?.archivos || []
  const isEditable = Boolean(puedeEditar)
  const buttonLabel = miEntrega ? 'Actualizar entrega' : 'Enviar entrega'

  const summaryText = useMemo(() => {
    if (tarea.tipoEntrega === 'PRESENCIAL') return 'Esta tarea se registra presencialmente por el docente.'
    if (tarea.tipoEntrega === 'FIRMA') return 'Sube una o varias imágenes de la firma o evidencia fotográfica.'
    if (tarea.tipoEntrega === 'REVISION_EN_LINEA') return 'Puedes enviar comentario, archivos o ambos.'
    return 'Adjunta uno o varios archivos en PDF, Word o imagen.'
  }, [tarea.tipoEntrega])

  const toggleRemove = (id) => {
    setRemoveIds((prev) => prev.includes(id)
      ? prev.filter((value) => value !== id)
      : [...prev, id])
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isEditable || saving) return
    setError('')
    setSuccess('')
    const remaining = existingFiles.filter((file) => !removeIds.includes(file.id)).length + archivos.length
    if (!remaining && (tarea.tipoEntrega !== 'REVISION_EN_LINEA' || !comentario.trim())) {
      setError(tarea.tipoEntrega === 'REVISION_EN_LINEA' ? 'Escribe un comentario o adjunta un archivo antes de enviar.' : 'Adjunta al menos un archivo antes de enviar.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        comentario,
        removerArchivoIds: removeIds,
      }
      if (miEntrega) await editarMiEntrega(tarea.id, payload, archivos)
      else await entregar(tarea.id, payload, archivos)
      setSuccess('Tu entrega se guardó correctamente.')
      await onSuccess?.()
      setArchivos([])
      setRemoveIds([])
    } catch (error) {
      setError(taskError(error, 'No fue posible enviar la tarea. Tus archivos siguen seleccionados.'))
    } finally {
      setSaving(false)
    }
  }

  if (tarea.tipoEntrega === 'PRESENCIAL') {
    return (
      <div className="rounded-3xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        {summaryText}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TaskNotice error={error} success={success} />
      <p className="text-sm text-muted-foreground">{deliveryHelp(tarea, miEntrega, isEditable)}</p>
      <div className="rounded-3xl border border-border bg-muted/40 p-5">
        <p className="text-sm font-semibold text-foreground">Indicaciones de entrega</p>
        <p className="mt-2 text-sm text-muted-foreground">{summaryText}</p>
      </div>

      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Archivos actuales</p>
          {existingFiles.map((file) => (
            <label key={file.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <a href={taskFileUrl(file.url, api.defaults.baseURL)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary-ink">
                <FileBadge2 className="h-4 w-4" />
                {file.nombre}
              </a>
              {isEditable && (
                <span className="flex items-center gap-2">Quitar al enviar<input
                  type="checkbox"
                  disabled={saving}
                  checked={removeIds.includes(file.id)}
                  onChange={() => toggleRemove(file.id)}
                /></span>
              )}
            </label>
          ))}
        </div>
      )}

      <label className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-border bg-muted/40 px-5 py-6 text-center">
        <div className="mx-auto rounded-full bg-card p-3 shadow-sm">
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Agregar archivos</p>
          <p className="mt-1 text-sm text-muted-foreground">Hasta 12 archivos nuevos, máximo 15 MB cada uno</p>
        </div>
        <input
          type="file"
          multiple
          accept={getAcceptByTaskType(tarea.tipoEntrega)}
          onChange={(event) => {
            try {
              setArchivos(mergeTaskFiles(archivos, Array.from(event.target.files || []), tarea.tipoEntrega === 'FIRMA'))
              setError('')
            } catch (error) { setError(error.message) }
            event.target.value = ''
          }}
          disabled={!isEditable || saving}
          className="mx-auto block max-w-full text-sm"
        />
      </label>

      {archivos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nuevos archivos</p>
          {archivos.map((file, index) => (
            <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              <Button variant="destructive" type="button" disabled={saving} onClick={() => setArchivos((files) => files.filter((_, i) => i !== index))} className="ml-3" aria-label={`Quitar ${file.name}`}>Quitar</Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="delivery-comment">Comentario al docente</label>
        <textarea
          id="delivery-comment"
          maxLength={5000}
          value={comentario}
          onChange={(event) => setComentario(event.target.value)}
          rows={4}
          disabled={!isEditable || saving}
          className="w-full rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40"
          placeholder="Explica tu entrega o agrega contexto adicional"
        />
      </div>

      <Button variant="default"
        type="submit"
        disabled={!isEditable || saving}
        className="w-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Guardando...' : buttonLabel}
      </Button>
    </form>
  )
}
