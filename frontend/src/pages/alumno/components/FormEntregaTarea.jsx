import { useMemo, useState } from 'react'
import { FileBadge2, UploadCloud } from 'lucide-react'
import api from '../../../api/axios'
import { useTareaStore } from '../../../store/tareaStore'

function resolveApiUrl(url) {
  if (!url) return '#'
  return new URL(url, api.defaults.baseURL).toString()
}

function getAcceptByTaskType(tipoEntrega) {
  if (tipoEntrega === 'FIRMA') return '.png,.jpg,.jpeg,.webp'
  return '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp'
}

export default function FormEntregaTarea({ tarea, miEntrega, puedeEditar, onSuccess }) {
  const { entregar, editarMiEntrega } = useTareaStore()
  const [comentario, setComentario] = useState(miEntrega?.comentarioAlumno || '')
  const [archivos, setArchivos] = useState([])
  const [removeIds, setRemoveIds] = useState([])
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
    setSaving(true)
    try {
      const payload = {
        comentario,
        removerArchivoIds: removeIds,
      }
      if (miEntrega) await editarMiEntrega(tarea.id, payload, archivos)
      else await entregar(tarea.id, payload, archivos)
      onSuccess?.()
      setArchivos([])
      setRemoveIds([])
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No fue posible enviar la tarea')
    } finally {
      setSaving(false)
    }
  }

  if (tarea.tipoEntrega === 'PRESENCIAL') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        {summaryText}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">Indicaciones de entrega</p>
        <p className="mt-2 text-sm text-slate-600">{summaryText}</p>
      </div>

      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Archivos actuales</p>
          {existingFiles.map((file) => (
            <label key={file.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <a href={resolveApiUrl(file.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-sky-700">
                <FileBadge2 className="h-4 w-4" />
                {file.nombre}
              </a>
              {isEditable && (
                <input
                  type="checkbox"
                  checked={removeIds.includes(file.id)}
                  onChange={() => toggleRemove(file.id)}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <label className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
        <div className="mx-auto rounded-full bg-white p-3 shadow-sm">
          <UploadCloud className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Agregar archivos</p>
          <p className="mt-1 text-sm text-slate-500">Múltiples archivos permitidos</p>
        </div>
        <input
          type="file"
          multiple
          accept={getAcceptByTaskType(tarea.tipoEntrega)}
          onChange={(event) => setArchivos(Array.from(event.target.files || []))}
          disabled={!isEditable}
          className="hidden"
        />
      </label>

      {archivos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Nuevos archivos</p>
          {archivos.map((file) => (
            <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {file.name}
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Comentario al docente</label>
        <textarea
          value={comentario}
          onChange={(event) => setComentario(event.target.value)}
          rows={4}
          disabled={!isEditable}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:bg-slate-50"
          placeholder="Explica tu entrega o agrega contexto adicional"
        />
      </div>

      <button
        type="submit"
        disabled={!isEditable || saving}
        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Guardando...' : buttonLabel}
      </button>
    </form>
  )
}
