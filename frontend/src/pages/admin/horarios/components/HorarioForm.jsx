import { useEffect, useMemo, useState } from 'react'
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
      semestre: clase.semestre ? String(clase.semestre) : '',
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
    semestre: grupoSeleccionado?.semestre ? String(grupoSeleccionado.semestre) : '',
  }
}

export default function HorarioForm({
  modo,
  clase,
  preset,
  onSaved,
  onCancelEdit,
  onEliminar,
  soloPropias = false,
}) {
  const {
    materiasCatalogo,
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

  useEffect(() => {
    setForm(crearEstadoInicial({ clase, preset, modo, docenteSeleccionado, grupoSeleccionado }))
    setSubmitError('')
    setConfirmEliminar(false)
    clearValidation()
  }, [clase, preset, modo, docenteSeleccionado?.id, grupoSeleccionado?.id, clearValidation])

  const bloquesOrdenados = useMemo(() => ordenarBloques(form.bloques), [form.bloques])

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
    semestre: form.semestre ? Number(form.semestre) : undefined,
  }), [bloquesOrdenados, form])

  const bloquesIncompletos = bloquesOrdenados.filter((bloque) => !bloque.horaInicio || !bloque.horaFin)
  const bloquesInvalidos = bloquesOrdenados.filter(
    (bloque) => bloque.horaInicio && bloque.horaFin && bloque.horaInicio >= bloque.horaFin,
  )

  const estaCompleto = Boolean(
    form.materiaId &&
    form.docenteId &&
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
      setSubmitError('Completa materia, docente y la hora de cada día seleccionado.')
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
    ? { tone: 'slate', message: 'Completa el formulario para validar disponibilidad.' }
    : bloquesInvalidos.length > 0
      ? { tone: 'red', message: 'Cada día debe tener una hora de inicio menor que la hora de fin.' }
      : validating
        ? { tone: 'amber', message: 'Validando disponibilidad...' }
        : validation.ok
          ? { tone: 'green', message: validation.message || 'Horario disponible, sin conflictos.' }
          : { tone: 'red', message: validation.message || 'Existe un conflicto de horario.' }

  const validacionLista = estaCompleto && bloquesInvalidos.length === 0 && !validating && Boolean(validation.message)

  const clasesEstado = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[estadoValidacion.tone]

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {clase ? 'Editar clase' : 'Nueva clase'}
          </h2>
          <p className="text-xs text-slate-500">
            {clase
              ? 'Los cambios se aplican a todos los días de la clase. Quita un día para retirarlo del horario.'
              : 'Programa materia, docente, grupo y un bloque independiente por cada día.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(crearEstadoInicial({ clase: null, modo, docenteSeleccionado, grupoSeleccionado }))
            setSubmitError('')
            clearValidation()
            onCancelEdit?.()
          }}
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Cerrar
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Materia</label>
          <select
            value={form.materiaId}
            onChange={(e) => updateField('materiaId', e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona una materia</option>
            {materiasCatalogo.map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.clave} · {materia.nombre}
              </option>
            ))}
          </select>
        </div>

        {soloPropias ? (
          // El docente sólo programa para sí: el servidor ignora cualquier otro.
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Docente</label>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {docenteSeleccionado?.nombre ?? 'Tú'}
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Docente</label>
            <select
              value={form.docenteId}
              onChange={(e) => updateField('docenteId', e.target.value)}
              disabled={modo === 'docente' && Boolean(docenteSeleccionado?.id)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
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
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Grupo</label>
          <select
            value={form.grupoId}
            onChange={(e) => updateField('grupoId', e.target.value)}
            disabled={modo === 'grupo' && Boolean(grupoSeleccionado?.id)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          >
            <option value="">Sin grupo específico</option>
            {grupos.map((grupo) => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.nombre} · Sem {grupo.semestre} · {grupo.periodo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Aula</label>
          <select
            value={form.aulaId}
            onChange={(e) => updateField('aulaId', e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <p className="mt-1 text-xs text-slate-500">
            Se valida que el aula esté libre en los días y horas seleccionados.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Días</label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((dia) => {
              const activo = bloquesOrdenados.some((bloque) => bloque.dia === dia)

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => toggleDia(dia)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activo
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'
                  }`}
                >
                  {dia}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Cada día seleccionado puede tener un horario diferente.
          </p>
        </div>

        {bloquesOrdenados.length > 0 && (
          <div className="space-y-3">
            {bloquesOrdenados.map((bloque) => (
              <div key={bloque.dia} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700">{bloque.dia}</span>
                  <button
                    type="button"
                    onClick={() => toggleDia(bloque.dia)}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600"
                  >
                    Quitar
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de inicio</label>
                    <input
                      type="time"
                      value={bloque.horaInicio}
                      onChange={(e) => updateBloque(bloque.dia, 'horaInicio', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de fin</label>
                    <input
                      type="time"
                      value={bloque.horaFin}
                      onChange={(e) => updateBloque(bloque.dia, 'horaFin', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Semestre</label>
          <input
            type="number"
            min="1"
            max="12"
            value={form.semestre}
            onChange={(e) => updateField('semestre', e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-sm ${clasesEstado}`}>
        {estadoValidacion.message}
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!validacionLista || saving || !validation.ok}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? 'Guardando...'
          : clase
            ? 'Guardar cambios'
            : 'Crear clase'}
      </button>

      {clase && (
        confirmEliminar ? (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              Se retirarán del horario los {clase.bloques.length} día
              {clase.bloques.length === 1 ? '' : 's'} de esta clase.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmEliminar(false)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-white"
              >
                Cancelar
              </button>
              <button
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
                className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar clase
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmEliminar(true)}
            className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Eliminar clase del horario
          </button>
        )
      )}
    </form>
  )
}
