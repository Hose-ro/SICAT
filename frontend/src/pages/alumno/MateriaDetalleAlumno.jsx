import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import TablaAsistenciasAlumno from './components/TablaAsistenciasAlumno'
import { useTareaStore } from '../../store/tareaStore'
import { useClaseStore } from '../../store/claseStore'

const ESTADO_TAREA = {
  null:         { label: 'Pendiente',    bg: 'bg-slate-50',   text: 'text-slate-600',  ring: 'ring-slate-200'  },
  PENDIENTE:    { label: 'Pendiente',    bg: 'bg-slate-50',   text: 'text-slate-600',  ring: 'ring-slate-200'  },
  ENTREGADA:    { label: 'Entregada',    bg: 'bg-blue-50',    text: 'text-blue-700',   ring: 'ring-blue-200'   },
  REVISADA:     { label: 'Revisada',     bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-200'  },
  CALIFICADA:   { label: 'Calificada',   bg: 'bg-emerald-50', text: 'text-emerald-700',ring: 'ring-emerald-200'},
  INCORRECTA:   { label: 'Incorrecta',   bg: 'bg-rose-50',    text: 'text-rose-700',   ring: 'ring-rose-200'   },
  NO_ENTREGADA: { label: 'No entregada', bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-200'  },
}

function EstadoTareaBadge({ estado }) {
  const cfg = ESTADO_TAREA[estado] ?? ESTADO_TAREA[null]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TABS = [
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'tareas',      label: 'Tareas'      },
]

export default function MateriaDetalleAlumno() {
  const { id } = useParams()
  const [tab, setTab] = useState('asistencias')
  const { misEntregas, obtenerMisTareas, loading } = useTareaStore()
  const { misClasesActivas, obtenerMisClasesActivas } = useClaseStore()

  useEffect(() => {
    if (tab === 'tareas') obtenerMisTareas(Number(id))
  }, [tab, id])

  useEffect(() => {
    obtenerMisClasesActivas().catch(() => {})
    const interval = setInterval(() => {
      obtenerMisClasesActivas().catch(() => {})
    }, 20000)
    return () => clearInterval(interval)
  }, [id])

  const claseActiva = misClasesActivas.find((clase) => clase.materiaId === Number(id))

  const byUnidad = misEntregas.reduce((acc, item) => {
    const k = item.tarea.unidadRef?.nombre
      || (item.tarea.unidad ? `Unidad ${item.tarea.unidad}` : 'Sin unidad')
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      {claseActiva && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Clase en curso</p>
              <p className="text-sm text-emerald-800">
                {claseActiva.materia?.nombre} · {claseActiva.grupo?.nombre ?? 'Grupo'} · {claseActiva.horarioMateria?.aula?.nombre ?? 'Aula pendiente'}
              </p>
            </div>
          </div>
          <span className="self-start rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:self-auto">
            {claseActiva.unidadRef?.nombre ?? `Unidad ${claseActiva.unidad}`}
          </span>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-slate-900 dark:bg-white/70" />
            )}
          </button>
        ))}
      </div>

      {tab === 'asistencias' && <TablaAsistenciasAlumno materiaId={Number(id)} />}

      {tab === 'tareas' && (
        <div className="space-y-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : misEntregas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <p className="text-sm font-medium text-slate-500">Sin tareas</p>
              <p className="mt-1 text-xs text-slate-400">No hay tareas publicadas para esta materia.</p>
            </div>
          ) : (
            Object.entries(byUnidad).map(([unidad, items]) => (
              <div key={unidad} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{unidad}</p>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50">
                  {items.map(({ tarea, miEntrega, estadoAlumno }) => {
                    const estado = miEntrega?.estadoRevision ?? estadoAlumno ?? null
                    const fechaLimite = formatDate(tarea.fechaLimite)
                    return (
                      <div key={tarea.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{tarea.titulo}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {tarea.unidadRef?.nombre || unidad}
                            {fechaLimite ? ` · Límite: ${fechaLimite}` : ' · Sin límite'}
                          </p>
                          {miEntrega?.observacion && (
                            <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">{miEntrega.observacion}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {miEntrega?.fueTardia && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 ring-1 ring-amber-200">
                              Tardía
                            </span>
                          )}
                          {miEntrega?.calificacion != null && (
                            <span className="text-sm font-bold text-emerald-700">
                              {miEntrega.calificacion}/100
                            </span>
                          )}
                          <EstadoTareaBadge estado={estado} />
                          <Link
                            to={`/alumno/tareas/${tarea.id}`}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Ver →
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
