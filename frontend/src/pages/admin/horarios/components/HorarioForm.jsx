import { Button } from '@/components/ui/button'
import { useId, useEffect, useMemo, useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const ORDEN_DIAS = {
  Lunes: 1,
  Martes: 2,
  Miercoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sabado: 6,
}

function ordenarBloques(bloques) {
  return [...bloques].sort((a, b) => (ORDEN_DIAS[a.dia] ?? 99) - (ORDEN_DIAS[b.dia] ?? 99))
}

function crearEstadoInicial({ clase, preset, modo, docenteSeleccionado, grupoSeleccionado }) {
  if (clase) {
    return {
      materiaId: String(clase.materiaId),
      docenteId: String(clase.docenteId),
      grupoId: clase.grupoId ? String(clase.grupoId) : '',
      aulaId: clase.aulaId ? String(clase.aulaId) : '',
      bloques: ordenarBloques(
        clase.bloques.map((bloque) => ({
          dia: bloque.dia,
          horaInicio: bloque.horaInicio,
          horaFin: bloque.horaFin,
        })),
      ),
    }
  }

  return {
    materiaId: '',
    docenteId: modo === 'docente' && docenteSeleccionado?.id ? String(docenteSeleccionado.id) : '',
    grupoId: modo === 'grupo' && grupoSeleccionado?.id ? String(grupoSeleccionado.id) : '',
    aulaId: '',
    bloques: preset?.dia
      ? [{ dia: preset.dia, horaInicio: preset.horaInicio ?? '', horaFin: preset.horaFin ?? '' }]
      : [],
  }
}

function HorarioFormFields({
  modo,
  clase,
  preset,
  onSaved,
  onCancelEdit,
  onEliminar,
  soloPropias = false,
}) {
  const fieldId = useId()
  const {
    materiasCatalogo,
    materiasGrupo,
    materiasGrupoId,
    materiasGrupoLoading,
    cargarMateriasDeGrupo,
    docentesCatalogo,
    aulasCatalogo,
    grupos,
    docenteSeleccionado,
    grupoSeleccionado,
    crearHorario,
    actualizarClase,
    validarHorario,
    validation,
    validating,
    saving,
    clearValidation,
  } = useHorarioStore()

  const [form, setForm] = useState(() =>
    crearEstadoInicial({ clase, preset, modo, docenteSeleccionado, grupoSeleccionado }),
  )
  const [submitError, setSubmitError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  useEffect(() => { clearValidation() }, [clearValidation])

  const bloquesOrdenados = useMemo(() => ordenarBloques(form.bloques), [form.bloques])

  // El docente programa siempre para un grupo: de ahí sale el semestre y, con
  // él, las materias de la retícula que puede impartir. El admin conserva la
  // opción de bloques sin grupo.
  const requiereGrupo = soloPropias
  const grupoElegido = useMemo(
    () => grupos.find((grupo) => String(grupo.id) === String(form.grupoId)) ?? null,
    [grupos, form.grupoId],
  )

  useEffect(() => {
    cargarMateriasDeGrupo(form.grupoId)
  }, [form.grupoId, cargarMateriasDeGrupo])

  const materiasDelGrupoListas =
    Boolean(form.grupoId) && materiasGrupoId === Number(form.grupoId) && !materiasGrupoLoading

  const materiasDisponibles = useMemo(() => {
    if (!form.grupoId) return requiereGrupo ? [] : materiasCatalogo
    return materiasDelGrupoListas ? materiasGrupo : []
  }, [form.grupoId, requiereGrupo, materiasCatalogo, materiasDelGrupoListas, materiasGrupo])

  // Reconcile a removed catalog option before rendering/validating the form.
  if (materiasDelGrupoListas && form.materiaId && !materiasDisponibles.some((materia) => String(materia.id) === String(form.materiaId))) {
    setForm({ ...form, materiaId: '' })
  }

  const payload = useMemo(() => ({
    materiaId: Number(form.materiaId),
    docenteId: Number(form.docenteId),
    grupoId: form.grupoId ? Number(form.grupoId) : undefined,
    aulaId: form.aulaId ? Number(form.aulaId) : null,
    bloques: bloquesOrdenados.map((bloque) => ({
      dia: bloque.dia,
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
    })),
  }), [bloquesOrdenados, form])

  const bloquesIncompletos = bloquesOrdenados.filter((bloque) => !bloque.horaInicio || !bloque.horaFin)
  const bloquesInvalidos = bloquesOrdenados.filter(
    (bloque) => bloque.horaInicio && bloque.horaFin && bloque.horaInicio >= bloque.horaFin,
  )

  const estaCompleto = Boolean(
    form.materiaId &&
    form.docenteId &&
    (!requiereGrupo || form.grupoId) &&
    bloquesOrdenados.length > 0 &&
    bloquesIncompletos.length === 0,
  )

  useEffect(() => {
    if (!estaCompleto || bloquesInvalidos.length > 0) {
      clearValidation()
      return
    }

    const timeout = setTimeout(() => {
      validarHorario(payload, clase?.horarioIds)
    }, 250)

    return () => clearTimeout(timeout)
  }, [estaCompleto, bloquesInvalidos.length, payload, clase, validarHorario, clearValidation])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSubmitError('')
    clearValidation()
  }

  function updateGrupo(value) {
    setForm((prev) => ({ ...prev, grupoId: value, materiaId: '' }))
    setSubmitError('')
    clearValidation()
  }

  function toggleDia(dia) {
    setForm((prev) => {
      const existe = prev.bloques.find((bloque) => bloque.dia === dia)
      const referencia = prev.bloques[0]

      return {
        ...prev,
        bloques: existe
          ? prev.bloques.filter((bloque) => bloque.dia !== dia)
          : ordenarBloques([
              ...prev.bloques,
              {
                dia,
                horaInicio: referencia?.horaInicio ?? '',
                horaFin: referencia?.horaFin ?? '',
              },
            ]),
      }
    })
    setSubmitError('')
    clearValidation()
  }

  function updateBloque(dia, field, value) {
    setForm((prev) => ({
      ...prev,
      bloques: prev.bloques.map((bloque) => (
        bloque.dia === dia ? { ...bloque, [field]: value } : bloque
      )),
    }))
    setSubmitError('')
    clearValidation()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')

    if (!estaCompleto) {
      setSubmitError(
        requiereGrupo
          ? 'Selecciona el grupo, la materia y la hora de cada día seleccionado.'
          : 'Completa materia, docente y la hora de cada día seleccionado.',
      )
      return
    }

    if (bloquesInvalidos.length > 0) {
      setSubmitError('Cada bloque debe tener una hora de inicio menor que la hora de fin.')
      return
    }

    const currentValidation = await validarHorario(payload, clase?.horarioIds)
    if (!currentValidation.ok) {
      setSubmitError(currentValidation.message || 'Existe un conflicto de horario.')
      return
    }

    try {
      if (clase) {
        await actualizarClase({ ...payload, horarioIds: clase.horarioIds })
      } else {
        await crearHorario(payload)
      }

      setForm(crearEstadoInicial({ clase: null, modo, docenteSeleccionado, grupoSeleccionado }))
      clearValidation()
      onSaved?.()
    } catch (error) {
      setSubmitError(error.message)
    }
  }

  const estadoValidacion = !estaCompleto
    ? {
        tone: 'slate',
        message:
          requiereGrupo && !form.grupoId
            ? 'Selecciona primero el grupo al que le vas a dar clase.'
            : 'Completa el formulario para validar disponibilidad.',
      }
    : bloquesInvalidos.length > 0
      ? { tone: 'red', message: 'Cada día debe tener una hora de inicio menor que la hora de fin.' }
      : validating
        ? { tone: 'amber', message: 'Validando disponibilidad...' }
        : validation.ok
          ? { tone: 'green', message: validation.message || 'Horario disponible, sin conflictos.' }
          : { tone: 'red', message: validation.message || 'Existe un conflicto de horario.' }

  const validacionLista = estaCompleto && bloquesInvalidos.length === 0 && !validating && Boolean(validation.message)

  const clasesEstado = {
    green: "border-success/30 bg-success/10 text-success-foreground",
    red: "border-destructive/30 bg-destructive/10 text-destructive-foreground",
    amber: "border-warning/30 bg-warning/10 text-warning-foreground",
    slate: "border-border bg-background text-muted-foreground",
  }[estadoValidacion.tone]

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {clase ? 'Editar clase' : 'Nueva clase'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {clase
              ? 'Los cambios se aplican a todos los días de la clase. Quita un día para retirarlo del horario.'
              : 'Elige el grupo, la materia de su semestre y un bloque independiente por cada día.'}
          </p>
        </div>
        <Button variant="ghost"
          type="button"
          onClick={() => {
            setForm(crearEstadoInicial({ clase: null, modo, docenteSeleccionado, grupoSeleccionado }))
            setSubmitError('')
            clearValidation()
            onCancelEdit?.()
          }}
          className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Cerrar
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor={fieldId + '-control-297'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grupo</label>
          <select id={fieldId + '-control-297'}
            value={form.grupoId}
            onChange={(e) => updateGrupo(e.target.value)}
            disabled={modo === 'grupo' && Boolean(grupoSeleccionado?.id)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-background"
          >
            <option value="">{requiereGrupo ? 'Selecciona un grupo' : 'Sin grupo específico'}</option>
            {grupos.map((grupo) => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.nombre} · Sem {grupo.semestre} · {grupo.periodo}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {grupoElegido
              ? `Verás las materias de ${grupoElegido.semestre}° semestre de la retícula${grupoElegido.carrera?.nombre ? ` de ${grupoElegido.carrera.nombre}` : ''}.`
              : 'El semestre del grupo determina las materias que puedes programar.'}
          </p>
        </div>

        <div>
          <label htmlFor={fieldId + '-control-319'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materia</label>
          <select id={fieldId + '-control-319'}
            value={form.materiaId}
            onChange={(e) => updateField('materiaId', e.target.value)}
            disabled={(requiereGrupo && !form.grupoId) || (Boolean(form.grupoId) && !materiasDelGrupoListas)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-background disabled:text-muted-foreground"
          >
            <option value="">
              {requiereGrupo && !form.grupoId
                ? 'Primero selecciona un grupo'
                : form.grupoId && !materiasDelGrupoListas
                  ? 'Cargando materias del grupo...'
                  : 'Selecciona una materia'}
            </option>
            {materiasDisponibles.map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.clave} · {materia.nombre}
              </option>
            ))}
          </select>
          {materiasDelGrupoListas && materiasDisponibles.length === 0 && (
            <p className="mt-1 text-xs text-warning-foreground">
              La retícula no tiene materias de {grupoElegido?.semestre}° semestre registradas para este grupo.
            </p>
          )}
        </div>

        {soloPropias ? (
          // El docente sólo programa para sí: el servidor ignora cualquier otro.
          <div>
            <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Docente</p>
            <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              {docenteSeleccionado?.nombre ?? 'Tú'}
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor={fieldId + '-control-356'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Docente</label>
            <select id={fieldId + '-control-356'}
              value={form.docenteId}
              onChange={(e) => updateField('docenteId', e.target.value)}
              disabled={modo === 'docente' && Boolean(docenteSeleccionado?.id)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-background"
            >
              <option value="">Selecciona un docente</option>
              {docentesCatalogo.map((docente) => (
                <option key={docente.id} value={docente.id}>
                  {docente.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor={fieldId + '-control-374'} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aula</label>
          <select id={fieldId + '-control-374'}
            value={form.aulaId}
            onChange={(e) => updateField('aulaId', e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sin aula asignada</option>
            {aulasCatalogo.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {aula.nombre}
                {aula.edificio ? ` · ${aula.edificio}` : ''}
                {aula.capacidad ? ` · ${aula.capacidad} lugares` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Se valida que el aula esté libre en los días y horas seleccionados.
          </p>
        </div>

        <div>
          <p className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Días</p>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((dia) => {
              const activo = bloquesOrdenados.some((bloque) => bloque.dia === dia)

              return (
                <Button variant="ghost"
                  key={dia}
                  type="button"
                  onClick={() => toggleDia(dia)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activo
                      ? "border-border bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-border"
                  }`}
                >
                  {dia}
                </Button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada día seleccionado puede tener un horario diferente.
          </p>
        </div>

        {bloquesOrdenados.length > 0 && (
          <div className="space-y-3">
            {bloquesOrdenados.map((bloque) => (
              <div key={bloque.dia} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">{bloque.dia}</span>
                  <Button variant="ghost"
                    type="button"
                    onClick={() => toggleDia(bloque.dia)}
                    className="text-xs font-medium text-muted-foreground hover:text-muted-foreground"
                  >
                    Quitar
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={fieldId + '-control-438' + '-' + (bloque.dia)} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hora de inicio</label>
                    <input id={fieldId + '-control-438' + '-' + (bloque.dia)}
                      type="time"
                      value={bloque.horaInicio}
                      onChange={(e) => updateBloque(bloque.dia, 'horaInicio', e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor={fieldId + '-control-447' + '-' + (bloque.dia)} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hora de fin</label>
                    <input id={fieldId + '-control-447' + '-' + (bloque.dia)}
                      type="time"
                      value={bloque.horaFin}
                      onChange={(e) => updateBloque(bloque.dia, 'horaFin', e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`rounded-lg border px-3 py-2 text-sm ${clasesEstado}`}>
        {estadoValidacion.message}
      </div>

      {submitError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {submitError}
        </div>
      )}

      <Button variant="default"
        type="submit"
        disabled={!validacionLista || saving || !validation.ok}
        className="w-full px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? 'Guardando...'
          : clase
            ? 'Guardar cambios'
            : 'Crear clase'}
      </Button>

      {clase && (
        confirmEliminar ? (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-xs text-destructive-foreground">
              Se retirarán del horario los {clase.bloques.length} día
              {clase.bloques.length === 1 ? '' : 's'} de esta clase.
            </p>
            <div className="flex gap-2">
              <Button variant="outline"
                type="button"
                onClick={() => setConfirmEliminar(false)}
                className="flex-1 border px-3 py-1.5 text-xs"
              >
                Cancelar
              </Button>
              <Button variant="destructive"
                type="button"
                onClick={async () => {
                  try {
                    await onEliminar?.(clase)
                  } catch (error) {
                    setSubmitError(error.message)
                    setConfirmEliminar(false)
                  }
                }}
                disabled={saving}
                className="flex-1 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Eliminar clase
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive"
            type="button"
            onClick={() => setConfirmEliminar(true)}
            className="w-full border px-4 py-2 text-sm font-medium"
          >
            Eliminar clase del horario
          </Button>
        )
      )}
    </form>
  )
}

export default function HorarioForm(props) {
  const docenteId = useHorarioStore((state) => state.docenteSeleccionado?.id)
  const grupoId = useHorarioStore((state) => state.grupoSeleccionado?.id)
  const formKey = JSON.stringify([props.clase, props.preset, props.modo, docenteId, grupoId])
  return <HorarioFormFields key={formKey} {...props} />
}
