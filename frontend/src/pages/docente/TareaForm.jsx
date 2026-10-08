import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Save, Send, UploadCloud } from 'lucide-react'
import api from '../../api/axios'
import { useTareaStore } from '../../store/tareaStore'

import TaskNotice from '../../components/TaskNotice'
import TaskRubric from '../../components/TaskRubric'
import CriteriosModal from '@/components/calificaciones/CriteriosModal'
import useCriterios from '@/hooks/useCriterios'
import { criteriosDeActividad, tipoCriterio } from '@/lib/criterios'
import { mergeTaskFiles, taskError, TASK_TYPE_HELP } from '../../lib/tareas'

const DEFAULT_FORM = {
  titulo: '',
  instrucciones: '',
  materiaId: '',
  grupoId: '',
  unidadId: '',
  categoriaId: '',
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
  // "Nueva actividad ▸ Examen" llega con el criterio ya elegido.
  const queryCategoriaId = searchParams.get('categoriaId')
  const isEditing = Boolean(editId)

  const { crear, editar, obtenerDetalle, saving, error, clearError } = useTareaStore()

  const formRef = useRef(null)
  const [localError, setLocalError] = useState('')
  const [originalState, setOriginalState] = useState('BORRADOR')
  const [loaded, setLoaded] = useState(!isEditing)
  const [materias, setMaterias] = useState([])
  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    materiaId: queryMateriaId || '',
    grupoId: queryGrupoId || '',
    unidadId: queryUnidadId || '',
    categoriaId: queryCategoriaId || '',
  })
  const [existingFiles, setExistingFiles] = useState([])
  const [removeFileIds, setRemoveFileIds] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [loadingInitial, setLoadingInitial] = useState(isEditing)
  // Criterio que ya tenía la tarea, por si no está en la lista de su unidad.
  const [criterioGuardado, setCriterioGuardado] = useState(null)
  const [criteriosAbierto, setCriteriosAbierto] = useState(false)
  // Mientras el docente no elija cómo se entrega, el tipo de actividad lo propone.
  const [entregaTocada, setEntregaTocada] = useState(false)
  const [sugerenciaDe, setSugerenciaDe] = useState('')

  useEffect(() => {
    clearError()
    api.get('/materias/mis-materias')
      .then((res) => setMaterias(res.data || []))
      .catch((error) => setLocalError(taskError(error, 'No se pudieron cargar las materias. Recarga la página.')))
  }, [clearError])

  useEffect(() => {
    if (!isEditing) return
    obtenerDetalle(Number(editId))
      .then((task) => {
        setOriginalState(task.estado)
        setLoaded(true)
        setForm({
          titulo: task.titulo || '',
          instrucciones: task.instrucciones || '',
          materiaId: task.materiaId ? String(task.materiaId) : '',
          grupoId: task.grupoId ? String(task.grupoId) : '',
          unidadId: task.unidadId ? String(task.unidadId) : '',
          categoriaId: task.categoriaId ? String(task.categoriaId) : '',
          tipoEntrega: task.tipoEntrega || 'EN_LINEA',
          tipoEvaluacion: task.tipoEvaluacion || 'DIRECTA',
          permiteReenvio: Boolean(task.permiteReenvio),
          tieneFechaLimite: task.tieneFechaLimite !== false,
          fechaLimite: formatDateInput(task.fechaLimite),
          horaLimite: formatTimeInput(task.fechaLimite, task.horaLimite),
          rubricJson: task.rubricJson || '',
        })
        setCriterioGuardado(task.categoria ?? null)
        setExistingFiles(task.archivos || [])
      })
      .catch((error) => setLocalError(taskError(error, 'No se pudo cargar la tarea. Vuelve a la lista e intenta de nuevo.')))
      .finally(() => setLoadingInitial(false))
  }, [editId, isEditing, obtenerDetalle])

  // Los tipos de actividad son los criterios del grupo (los de la unidad, si
  // tiene porcentajes propios). Con la ponderación predeterminada todas las
  // tareas valen igual y no hay que elegir.
  const criterios = useCriterios(form.materiaId, form.grupoId)
  const conCriterios = criterios.datos?.base.origen === 'GRUPO'
  const opcionesCriterio = useMemo(() => {
    const lista = criteriosDeActividad(criterios.datos, form.unidadId)
    const actual = Number(form.categoriaId)
    if (actual && !lista.some((item) => item.id === actual) && criterioGuardado?.id === actual) {
      return [...lista, { ...criterioGuardado, peso: null, fueraDeLista: true }]
    }
    return lista
  }, [criterios.datos, form.unidadId, form.categoriaId, criterioGuardado])
  const criterioElegido = opcionesCriterio.find((criterio) => String(criterio.id) === String(form.categoriaId))
  if (!isEditing && !entregaTocada && criterioElegido && sugerenciaDe !== form.categoriaId) {
    setSugerenciaDe(form.categoriaId)
    setForm((prev) => ({ ...prev, tipoEntrega: tipoCriterio(criterioElegido.tipo).entrega ?? prev.tipoEntrega }))
  }
  const enClase = form.tipoEntrega === 'PRESENCIAL'

  const selectedMateria = useMemo(
    () => materias.find((materia) => materia.id === Number(form.materiaId)),
    [materias, form.materiaId],
  )

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    if (name === 'tipoEntrega') setEntregaTocada(true)
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'materiaId' ? { grupoId: '', unidadId: '', categoriaId: '' } : {}),
    }))
  }

  const handleFileSelect = (event) => {
    try {
      setNewFiles(mergeTaskFiles(newFiles, Array.from(event.target.files || [])))
      setLocalError('')
    } catch (error) { setLocalError(error.message) }
    event.target.value = ''
  }

  const toggleRemoveFile = (fileId) => {
    setRemoveFileIds((prev) => prev.includes(fileId)
      ? prev.filter((id) => id !== fileId)
      : [...prev, fileId])
  }

  const submitWithState = async (estado) => {
    if (saving || !loaded || !formRef.current.reportValidity()) return
    setLocalError('')
    if (!form.titulo.trim() || !form.instrucciones.trim()) {
      setLocalError(enClase ? 'Escribe el tema y lo que abarca.' : 'Escribe un título y las instrucciones de la tarea.')
      return
    }
    if (form.tipoEvaluacion === 'RUBRICA') {
      let rows
      try { rows = JSON.parse(form.rubricJson) } catch { setLocalError('Agrega los criterios de la rúbrica.'); return }
      if (Array.isArray(rows) && rows.every((row) => row && 'criterio' in row && 'peso' in row) &&
        (!rows.length || rows.some((row) => !row.criterio.trim() || Number(row.peso) <= 0) || rows.reduce((sum, row) => sum + Number(row.peso), 0) !== 100)) {
        setLocalError('Completa los criterios de la rúbrica y verifica que sumen 100%.')
        return
      }
    }
    const payload = {
      ...form,
      estado,
      materiaId: Number(form.materiaId),
      grupoId: Number(form.grupoId),
      unidadId: form.unidadId ? Number(form.unidadId) : undefined,
      // Vacío quita la categoría al editar.
      categoriaId: form.categoriaId ? Number(form.categoriaId) : isEditing ? '' : undefined,
      removerArchivoIds: removeFileIds,
      fechaLimite: form.tieneFechaLimite && form.fechaLimite ? `${form.fechaLimite}T${form.horaLimite || '23:59'}` : undefined,
      horaLimite: form.tieneFechaLimite ? form.horaLimite : undefined,
    }

    try {
      const result = isEditing
        ? await editar(Number(editId), payload, newFiles)
        : await crear(payload, newFiles)

      // Recién publicada: el detalle abre el diálogo para mandarla al grupo de WhatsApp.
      const recienPublicada = estado === 'PUBLICADA' && (!isEditing || originalState === 'BORRADOR')
      navigate(`/docente/tareas/${result.id}`, recienPublicada ? { state: { compartir: true } } : undefined)
    } catch (error) { setLocalError(taskError(error, 'No se pudo guardar la tarea. Tus cambios siguen en el formulario.')) }
  }

  if (loadingInitial) {
    return <div className="px-4 py-10 text-sm text-muted-foreground">Cargando tarea...</div>
  }

  return (
    <div className="space-y-6">
      <section className="task-hero px-6 py-7">
        <Button variant="ghost"
          type="button"
          onClick={() => navigate(-1)}
          className="task-hero-button inline-flex items-center gap-2  px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {isEditing ? 'Editar actividad' : 'Nueva actividad'}
              </h1>
              <p className="task-hero-subtitle mt-2 text-sm">
                Elige el grupo y el tipo de actividad (tarea, práctica, examen…), cómo se entrega y su fecha. Puede quedar en borrador o publicarse.
              </p>
            </div>
          </div>
          <div className="task-hero-surface rounded-3xl px-5 py-4 text-sm">
            <p className="task-hero-emphasis font-semibold">Formatos permitidos</p>
            <p className="task-hero-subtitle mt-1">PDF, Word e imagen. Hasta 12 archivos nuevos de 15 MB cada uno.</p>
          </div>
        </div>
      </section>

      <TaskNotice error={localError || error} />

      <form ref={formRef} onSubmit={(event) => { event.preventDefault(); submitWithState(isEditing ? originalState : 'PUBLICADA') }} className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="task-title">{enClase ? 'Tema *' : 'Título *'}</label>
              <input
                id="task-title" required maxLength={160} name="titulo"
                value={form.titulo}
                onChange={handleChange}
                placeholder={enClase ? 'Ej. Examen parcial 1: sistemas de archivos' : 'Ej. Ensayo sobre arquitectura de software libre'}
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="task-instructions">{enClase ? 'Temas que abarca e indicaciones *' : 'Instrucciones *'}</label>
              <textarea
                id="task-instructions" required maxLength={5000} name="instrucciones"
                value={form.instrucciones}
                onChange={handleChange}
                rows={8}
                placeholder={enClase ? 'Temas 2.1 a 2.4. Qué pueden llevar (calculadora, formulario) y cómo se califica.' : 'Describe la actividad, el criterio de evaluación y cualquier requisito de entrega.'}
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Materia</span>
                <select
                  required name="materiaId"
                  value={form.materiaId}
                  onChange={handleChange}
                  className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecciona una materia</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>{materia.nombre}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Grupo</span>
                <select
                  required name="grupoId"
                  value={form.grupoId}
                  onChange={handleChange}
                  disabled={!selectedMateria}
                  className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40"
                >
                  <option value="">Selecciona un grupo</option>
                  {(selectedMateria?.grupos || []).map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Unidad (opcional)</span>
                <select
                  name="unidadId"
                  value={form.unidadId}
                  onChange={handleChange}
                  disabled={!selectedMateria}
                  className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40"
                >
                  <option value="">Sin unidad</option>
                  {(selectedMateria?.unidades || []).map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
                  ))}
                </select>
              </label>
            </div>

            {form.materiaId && form.grupoId && criterios.datos && (
              <div>
                {conCriterios ? (
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Tipo de actividad *</span>
                    <select
                      name="categoriaId"
                      required
                      value={form.categoriaId}
                      onChange={handleChange}
                      className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring lg:max-w-sm"
                    >
                      <option value="">Selecciona el tipo</option>
                      {opcionesCriterio.map((criterio) => (
                        <option key={criterio.id} value={criterio.id}>
                          {criterio.fueraDeLista ? `${criterio.nombre} (no cuenta en esta unidad)` : `${criterio.nombre} (${criterio.peso} %)`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {conCriterios
                    ? 'El tipo es el criterio con el que cuenta esta actividad en la calificación del grupo.'
                    : 'Este grupo usa la ponderación predeterminada: todas las tareas valen igual. Para calificar exámenes, prácticas o participación por separado,'}
                  {' '}
                  <Button variant="link" type="button" className="h-auto min-h-0 p-0 text-xs" onClick={() => setCriteriosAbierto(true)}>
                    {conCriterios ? 'Editar criterios' : 'define sus criterios'}
                  </Button>
                  {conCriterios ? '' : '.'}
                </p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">¿Cómo se entrega?</span>
                <select
                  name="tipoEntrega"
                  value={form.tipoEntrega}
                  onChange={handleChange}
                  className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="PRESENCIAL">En clase (sin entrega en línea)</option>
                  <option value="EN_LINEA">Entrega con archivo</option>
                  <option value="FIRMA">Entrega con foto de firma</option>
                  <option value="REVISION_EN_LINEA">Comentario o archivos</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Tipo de evaluación</span>
                <select
                  name="tipoEvaluacion"
                  value={form.tipoEvaluacion}
                  onChange={handleChange}
                  className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="DIRECTA">Calificación directa</option>
                  <option value="RUBRICA">Rúbrica</option>
                </select>
              </label>
            </div>

            <p className="text-sm text-muted-foreground">{TASK_TYPE_HELP[form.tipoEntrega]}</p>
            <div className="rounded-3xl border border-border bg-muted/40 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Archivos adjuntos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Material de referencia o plantilla para el alumnado.</p>
                </div>
                <label className="inline-flex max-w-full cursor-pointer flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40">
                  <UploadCloud className="h-4 w-4" />
                  Agregar archivos
                  <input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={handleFileSelect} className="block w-full min-w-0 text-xs" />
                </label>
              </div>

              {existingFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Adjuntos actuales</p>
                  {existingFiles.map((file) => (
                    <label key={file.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground">{file.nombre}</p>
                        <p className="text-xs text-muted-foreground">{file.tipoArchivo}</p>
                      </div>
                      <span className="flex items-center gap-2">Quitar al guardar<input
                        type="checkbox"
                        checked={removeFileIds.includes(file.id)}
                        onChange={() => toggleRemoveFile(file.id)}
                      /></span>
                    </label>
                  ))}
                </div>
              )}

              {newFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nuevos archivos</p>
                  {newFiles.map((file, index) => (
                    <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                      {file.name}
                      <Button variant="destructive" type="button" onClick={() => setNewFiles((files) => files.filter((_, i) => i !== index))} className="ml-3" aria-label={`Quitar ${file.name}`}>Quitar</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Publicación y entrega</h2>
            </div>

            <div className="mt-5 space-y-5">
              <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <input
                  type="checkbox"
                  name="tieneFechaLimite"
                  checked={form.tieneFechaLimite}
                  onChange={handleChange}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{enClase ? 'Tiene fecha de aplicación' : 'Usar fecha límite'}</p>
                  <p className="text-sm text-muted-foreground">{enClase ? 'El día y la hora en que se aplica en clase. Aparece en el calendario del grupo.' : 'Si se desactiva, la tarea seguirá abierta hasta que la cierres manualmente.'}</p>
                </div>
              </label>

              {form.tieneFechaLimite && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">{enClase ? 'Fecha de aplicación' : 'Fecha límite'}</span>
                    <input
                      type="date"
                      required name="fechaLimite"
                      value={form.fechaLimite}
                      onChange={handleChange}
                      className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">{enClase ? 'Hora' : 'Hora límite'}</span>
                    <input
                      type="time"
                      name="horaLimite"
                      value={form.horaLimite}
                      onChange={handleChange}
                      className="w-full min-w-0 rounded-2xl border border-border px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                </div>
              )}

              {!enClase && <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <input
                  type="checkbox"
                  name="permiteReenvio"
                  checked={form.permiteReenvio}
                  onChange={handleChange}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">Permitir reenvío</p>
                  <p className="text-sm text-muted-foreground">Permite actualizar entregas después de la fecha límite mientras la tarea siga abierta. Antes del límite, el alumno puede actualizar su entrega.</p>
                </div>
              </label>}
            </div>
          </section>

          {form.tipoEvaluacion === 'RUBRICA' && <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Rúbrica</h2>
            <TaskRubric value={form.rubricJson} onChange={(rubricJson) => setForm((prev) => ({ ...prev, rubricJson }))} />
          </section>}

          <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{isEditing ? 'Guardar cambios conserva el estado actual de la tarea.' : 'El borrador solo es visible para ti. Al publicar, el grupo podrá ver la actividad.'}</p>
              <div className="flex flex-wrap gap-2 xl:flex-col">
                <Button variant="outline"
                  type="button"
                  onClick={() => submitWithState(isEditing ? originalState : 'BORRADOR')}
                  disabled={saving || !loaded}
                  className="inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar borrador'}
                </Button>
                {(!isEditing || originalState === 'BORRADOR') && <Button variant="default"
                  type="button"
                  onClick={() => submitWithState('PUBLICADA')}
                  disabled={saving || !loaded}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {saving ? 'Publicando...' : 'Publicar'}
                </Button>}
              </div>
            </div>
          </section>
        </aside>
      </form>
      <CriteriosModal
        open={criteriosAbierto}
        onClose={() => setCriteriosAbierto(false)}
        materiaId={form.materiaId}
        grupo={(selectedMateria?.grupos ?? []).find((grupo) => String(grupo.id) === form.grupoId)}
        materiaNombre={selectedMateria?.nombre}
        alcanceInicial={form.unidadId ? Number(form.unidadId) : 'base'}
        onGuardado={() => criterios.recargar()}
      />
    </div>
  )
}
