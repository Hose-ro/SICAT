import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Save, Send, UploadCloud } from 'lucide-react'
import api from '../../api/axios'
import { useTareaStore } from '../../store/tareaStore'

const DEFAULT_FORM = {
  titulo: '',
  instrucciones: '',
  materiaId: '',
  grupoId: '',
  unidadId: '',
  tipoEntrega: 'EN_LINEA',
  tipoEvaluacion: 'DIRECTA',
  permiteReenvio: false,
  tieneFechaLimite: true,
  fechaLimite: '',
  horaLimite: '',
  rubricJson: '',
}

function formatDateInput(date) {
  if (!date) return ''
  const value = new Date(date)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function formatTimeInput(date, fallback) {
  if (fallback) return fallback
  if (!date) return ''
  const value = new Date(date)
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

export default function TareaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('editarId')
  const queryMateriaId = searchParams.get('materiaId')
  const queryGrupoId = searchParams.get('grupoId')
  const queryUnidadId = searchParams.get('unidadId')
  const isEditing = Boolean(editId)

  const { crear, editar, obtenerDetalle, saving, error, clearError } = useTareaStore()

  const [materias, setMaterias] = useState([])
  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    materiaId: queryMateriaId || '',
    grupoId: queryGrupoId || '',
    unidadId: queryUnidadId || '',
  })
  const [existingFiles, setExistingFiles] = useState([])
  const [removeFileIds, setRemoveFileIds] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [loadingInitial, setLoadingInitial] = useState(isEditing)

  useEffect(() => {
    clearError()
    api.get('/materias/mis-materias')
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]))
  }, [clearError])

  useEffect(() => {
    if (!isEditing) return
    setLoadingInitial(true)
    obtenerDetalle(Number(editId))
      .then((task) => {
        setForm({
          titulo: task.titulo || '',
          instrucciones: task.instrucciones || '',
          materiaId: task.materiaId ? String(task.materiaId) : '',
          grupoId: task.grupoId ? String(task.grupoId) : '',
          unidadId: task.unidadId ? String(task.unidadId) : '',
          tipoEntrega: task.tipoEntrega || 'EN_LINEA',
          tipoEvaluacion: task.tipoEvaluacion || 'DIRECTA',
          permiteReenvio: Boolean(task.permiteReenvio),
          tieneFechaLimite: task.tieneFechaLimite !== false,
          fechaLimite: formatDateInput(task.fechaLimite),
          horaLimite: formatTimeInput(task.fechaLimite, task.horaLimite),
          rubricJson: task.rubricJson ? JSON.stringify(JSON.parse(task.rubricJson), null, 2) : '',
        })
        setExistingFiles(task.archivos || [])
      })
      .finally(() => setLoadingInitial(false))
  }, [editId, isEditing, obtenerDetalle])

  const selectedMateria = useMemo(
    () => materias.find((materia) => materia.id === Number(form.materiaId)),
    [materias, form.materiaId],
  )

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'materiaId' ? { grupoId: '', unidadId: '' } : {}),
    }))
  }

  const handleFileSelect = (event) => {
    setNewFiles(Array.from(event.target.files || []))
  }

  const toggleRemoveFile = (fileId) => {
    setRemoveFileIds((prev) => prev.includes(fileId)
      ? prev.filter((id) => id !== fileId)
      : [...prev, fileId])
  }

  const submitWithState = async (estado) => {
    const payload = {
      ...form,
      estado,
      materiaId: Number(form.materiaId),
      grupoId: Number(form.grupoId),
      unidadId: form.unidadId ? Number(form.unidadId) : undefined,
      removerArchivoIds: removeFileIds,
      fechaLimite: form.tieneFechaLimite && form.fechaLimite ? `${form.fechaLimite}T${form.horaLimite || '23:59'}` : undefined,
      horaLimite: form.tieneFechaLimite ? form.horaLimite : undefined,
    }

    const result = isEditing
      ? await editar(Number(editId), payload, newFiles)
      : await crear(payload, newFiles)

    navigate(`/docente/tareas/${result.id}`)
  }

  if (loadingInitial) {
    return <div className="px-4 py-10 text-sm text-slate-500">Cargando tarea...</div>
  }

  return (
    <div className="space-y-6">
      <section className="task-hero px-6 py-7">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="task-hero-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {isEditing ? 'Editar tarea' : 'Nueva tarea'}
              </h1>
              <p className="task-hero-subtitle mt-2 text-sm">
                Configura la tarea por materia y grupo, define si tendrá fecha límite, sube adjuntos y decide si quedará en borrador o publicada.
              </p>
            </div>
          </div>
          <div className="task-hero-surface rounded-3xl px-5 py-4 text-sm">
            <p className="task-hero-emphasis font-semibold">Formatos permitidos</p>
            <p className="task-hero-subtitle mt-1">PDF, Word e imagen. Puedes adjuntar varios archivos.</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Título</label>
              <input
                name="titulo"
                value={form.titulo}
                onChange={handleChange}
                placeholder="Ej. Ensayo sobre arquitectura de software libre"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Instrucciones</label>
              <textarea
                name="instrucciones"
                value={form.instrucciones}
                onChange={handleChange}
                rows={8}
                placeholder="Describe la actividad, el criterio de evaluación y cualquier requisito de entrega."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">Materia</span>
                <select
                  name="materiaId"
                  value={form.materiaId}
                  onChange={handleChange}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                >
                  <option value="">Selecciona una materia</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>{materia.nombre}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">Grupo</span>
                <select
                  name="grupoId"
                  value={form.grupoId}
                  onChange={handleChange}
                  disabled={!selectedMateria}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:bg-slate-50"
                >
                  <option value="">Selecciona un grupo</option>
                  {(selectedMateria?.grupos || []).map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">Unidad (opcional)</span>
                <select
                  name="unidadId"
                  value={form.unidadId}
                  onChange={handleChange}
                  disabled={!selectedMateria}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:bg-slate-50"
                >
                  <option value="">Sin unidad</option>
                  {(selectedMateria?.unidades || []).map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">Tipo de tarea</span>
                <select
                  name="tipoEntrega"
                  value={form.tipoEntrega}
                  onChange={handleChange}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                >
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="EN_LINEA">Entrega con archivo</option>
                  <option value="FIRMA">Entrega con foto de firma</option>
                  <option value="REVISION_EN_LINEA">Revisión en línea</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">Tipo de evaluación</span>
                <select
                  name="tipoEvaluacion"
                  value={form.tipoEvaluacion}
                  onChange={handleChange}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                >
                  <option value="DIRECTA">Calificación directa</option>
                  <option value="RUBRICA">Rúbrica</option>
                </select>
              </label>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Archivos adjuntos</h2>
                  <p className="mt-1 text-sm text-slate-500">Material de referencia o plantilla para el alumnado.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <UploadCloud className="h-4 w-4" />
                  Agregar archivos
                  <input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>

              {existingFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Adjuntos actuales</p>
                  {existingFiles.map((file) => (
                    <label key={file.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      <div>
                        <p className="font-medium text-slate-800">{file.nombre}</p>
                        <p className="text-xs text-slate-400">{file.tipoArchivo}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={removeFileIds.includes(file.id)}
                        onChange={() => toggleRemoveFile(file.id)}
                      />
                    </label>
                  ))}
                </div>
              )}

              {newFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Nuevos archivos</p>
                  {newFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      {file.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">Publicación y entrega</h2>
            </div>

            <div className="mt-5 space-y-5">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  name="tieneFechaLimite"
                  checked={form.tieneFechaLimite}
                  onChange={handleChange}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Usar fecha límite</p>
                  <p className="text-sm text-slate-500">Si se desactiva, la tarea seguirá abierta hasta que la cierres manualmente.</p>
                </div>
              </label>

              {form.tieneFechaLimite && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700">Fecha límite</span>
                    <input
                      type="date"
                      name="fechaLimite"
                      value={form.fechaLimite}
                      onChange={handleChange}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700">Hora límite</span>
                    <input
                      type="time"
                      name="horaLimite"
                      value={form.horaLimite}
                      onChange={handleChange}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                    />
                  </label>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  name="permiteReenvio"
                  checked={form.permiteReenvio}
                  onChange={handleChange}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Permitir reenvío</p>
                  <p className="text-sm text-slate-500">El alumno podrá reenviar después de observaciones o fuera del primer envío si la tarea sigue abierta.</p>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Rúbrica opcional</h2>
            <p className="mt-1 text-sm text-slate-500">Solo si la evaluación será por rúbrica. Ingresa JSON válido.</p>
            <textarea
              name="rubricJson"
              value={form.rubricJson}
              onChange={handleChange}
              rows={10}
              placeholder='[{"criterio":"Investigación","peso":30}]'
              className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-xs text-slate-700 outline-none transition focus:border-sky-400"
            />
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => submitWithState('BORRADOR')}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
              <button
                type="button"
                onClick={() => submitWithState('PUBLICADA')}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {saving ? 'Publicando...' : isEditing ? 'Guardar y publicar' : 'Publicar tarea'}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
