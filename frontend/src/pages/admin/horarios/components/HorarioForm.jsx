import { useEffect, useMemo, useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

function crearEstadoInicial({ editingHorario, modo, docenteSeleccionado, grupoSeleccionado }) {
  if (editingHorario) {
    return {
      materiaId: String(editingHorario.materiaId),
      docenteId: String(editingHorario.docenteId),
      aulaId: String(editingHorario.aulaId),
      grupoId: editingHorario.grupoId ? String(editingHorario.grupoId) : '',
      dias: editingHorario.dias.split(',').map((dia) => dia.trim()).filter(Boolean),
      horaInicio: editingHorario.horaInicio,
      horaFin: editingHorario.horaFin,
      semestre: editingHorario.semestre ? String(editingHorario.semestre) : '',
    }
  }

  return {
    materiaId: '',
    docenteId: modo === 'docente' && docenteSeleccionado?.id ? String(docenteSeleccionado.id) : '',
    aulaId: '',
    grupoId: modo === 'grupo' && grupoSeleccionado?.id ? String(grupoSeleccionado.id) : '',
    dias: [],
    horaInicio: '',
    horaFin: '',
    semestre: grupoSeleccionado?.semestre ? String(grupoSeleccionado.semestre) : '',
  }
}

export default function HorarioForm({ modo, editingHorario, onSaved, onCancelEdit }) {
  const {
    materiasCatalogo,
    docentesCatalogo,
    grupos,
    aulas,
    docenteSeleccionado,
    grupoSeleccionado,
    crearHorario,
    actualizarHorario,
    validarHorario,
    validation,
    validating,
    saving,
    clearValidation,
  } = useHorarioStore()

  const [form, setForm] = useState(() =>
    crearEstadoInicial({ editingHorario, modo, docenteSeleccionado, grupoSeleccionado }),
  )
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    setForm(crearEstadoInicial({ editingHorario, modo, docenteSeleccionado, grupoSeleccionado }))
    setSubmitError('')
    clearValidation()
  }, [editingHorario, modo, docenteSeleccionado?.id, grupoSeleccionado?.id, clearValidation])

  const rangoInvalido = Boolean(form.horaInicio && form.horaFin && form.horaInicio >= form.horaFin)

  const payload = useMemo(() => ({
    materiaId: Number(form.materiaId),
    docenteId: Number(form.docenteId),
    aulaId: Number(form.aulaId),
    grupoId: form.grupoId ? Number(form.grupoId) : undefined,
    dias: form.dias,
    horaInicio: form.horaInicio,
    horaFin: form.horaFin,
    semestre: form.semestre ? Number(form.semestre) : undefined,
  }), [form])

  const estaCompleto = Boolean(
    form.materiaId &&
    form.docenteId &&
    form.aulaId &&
    form.dias.length > 0 &&
    form.horaInicio &&
    form.horaFin,
  )

  useEffect(() => {
    if (!estaCompleto || rangoInvalido) {
      clearValidation()
      return
    }

    const timeout = setTimeout(() => {
      validarHorario(payload, editingHorario?.id)
    }, 250)

    return () => clearTimeout(timeout)
  }, [estaCompleto, rangoInvalido, payload, editingHorario?.id, validarHorario, clearValidation])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSubmitError('')
    clearValidation()
  }

  function toggleDia(dia) {
    setForm((prev) => ({
      ...prev,
      dias: prev.dias.includes(dia)
        ? prev.dias.filter((item) => item !== dia)
        : [...prev.dias, dia],
    }))
    setSubmitError('')
    clearValidation()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')

    if (!estaCompleto) {
      setSubmitError('Completa materia, docente, aula, días y rango de horario.')
      return
    }

    if (rangoInvalido) {
      setSubmitError('La hora de inicio debe ser menor que la hora de fin.')
      return
    }

    const currentValidation = await validarHorario(payload, editingHorario?.id)
    if (!currentValidation.ok) {
      setSubmitError(currentValidation.message || 'Existe un conflicto de horario.')
      return
    }

    try {
      if (editingHorario?.id) {
        await actualizarHorario(editingHorario.id, payload)
      } else {
        await crearHorario(payload)
      }

      const nextState = crearEstadoInicial({ editingHorario: null, modo, docenteSeleccionado, grupoSeleccionado })
      setForm(nextState)
      clearValidation()
      onSaved?.()
    } catch (error) {
      setSubmitError(error.message)
    }
  }

  const estadoValidacion = !estaCompleto
    ? { tone: 'slate', message: 'Completa el formulario para validar disponibilidad.' }
    : rangoInvalido
      ? { tone: 'red', message: 'La hora de inicio debe ser menor que la hora de fin.' }
      : validating
        ? { tone: 'amber', message: 'Validando disponibilidad...' }
        : validation.ok
          ? { tone: 'green', message: validation.message || 'Horario disponible, sin conflictos.' }
          : { tone: 'red', message: validation.message || 'Existe un conflicto de horario.' }

  const validacionLista = estaCompleto && !rangoInvalido && !validating && Boolean(validation.message)

  const clasesEstado = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[estadoValidacion.tone]

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {editingHorario ? 'Editar horario' : 'Crear horario'}
          </h2>
          <p className="text-xs text-slate-500">
            Programa materia, docente, aula, grupo, días y horas.
          </p>
        </div>
        {editingHorario && (
          <button
            type="button"
            onClick={() => {
              setForm(crearEstadoInicial({ editingHorario: null, modo, docenteSeleccionado, grupoSeleccionado }))
              setSubmitError('')
              clearValidation()
              onCancelEdit?.()
            }}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Cancelar edición
          </button>
        )}
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

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Aula</label>
          <select
            value={form.aulaId}
            onChange={(e) => updateField('aulaId', e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona un aula</option>
            {aulas.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {aula.nombre}{aula.edificio ? ` · ${aula.edificio}` : ''}
              </option>
            ))}
          </select>
        </div>

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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de inicio</label>
            <input
              type="time"
              value={form.horaInicio}
              onChange={(e) => updateField('horaInicio', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de fin</label>
            <input
              type="time"
              value={form.horaFin}
              onChange={(e) => updateField('horaFin', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Días</label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((dia) => (
              <button
                key={dia}
                type="button"
                onClick={() => toggleDia(dia)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  form.dias.includes(dia)
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'
                }`}
              >
                {dia}
              </button>
            ))}
          </div>
        </div>

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
          : editingHorario
            ? 'Guardar cambios'
            : 'Crear horario'}
      </button>
    </form>
  )
}
