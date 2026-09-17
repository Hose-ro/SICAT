import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import TablaAsistenciasAlumno from './components/TablaAsistenciasAlumno'
import { useTareaStore } from '../../store/tareaStore'
import { useClaseStore } from '../../store/claseStore'

import { DELIVERY_STATE_LABEL } from '../../lib/tareas'
import TaskNotice from '../../components/TaskNotice'

const ESTADO_TAREA = {
  null:         { label: 'Pendiente',    bg: "bg-background",   text: "text-muted-foreground",  ring: "ring-ring"  },
  PENDIENTE:    { label: 'Pendiente',    bg: "bg-background",   text: "text-muted-foreground",  ring: "ring-ring"  },
  ENTREGADA:    { label: 'Entregada',    bg: "bg-accent",    text: "text-primary-ink",   ring: "ring-ring"   },
  REVISADA:     { label: 'Revisada',     bg: "bg-warning/10",   text: "text-warning-foreground",  ring: "ring-ring"  },
  CALIFICADA:   { label: 'Calificada',   bg: "bg-success/10", text: "text-success-foreground",ring: "ring-ring"},
  INCORRECTA:   { label: 'Incorrecta',   bg: "bg-destructive/10",    text: "text-destructive-foreground",   ring: "ring-ring"   },
  NO_ENTREGADA: { label: 'No entregada', bg: "bg-warning/10",   text: "text-warning-foreground",  ring: "ring-ring"  },
}

function EstadoTareaBadge({ estado }) {
  const cfg = ESTADO_TAREA[estado] ?? ESTADO_TAREA[null]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
      {DELIVERY_STATE_LABEL[estado] || 'Por entregar'}
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
  const { misEntregas, obtenerMisTareas, loading, error } = useTareaStore()
  const { misClasesActivas, obtenerMisClasesActivas } = useClaseStore()

  useEffect(() => {
    if (tab === 'tareas') obtenerMisTareas(Number(id)).catch(() => {})
  }, [tab, id, obtenerMisTareas])

  useEffect(() => {
    obtenerMisClasesActivas().catch(() => {})
    const interval = setInterval(() => {
      obtenerMisClasesActivas().catch(() => {})
    }, 20000)
    return () => clearInterval(interval)
  }, [id, obtenerMisClasesActivas])

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
      <h1 className="text-xl font-bold text-foreground">Asistencias y tareas de la materia</h1>
      {claseActiva && (
        <div className="flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-success-foreground">Clase en curso</p>
              <p className="text-sm text-success-foreground">
                {claseActiva.materia?.nombre} · {claseActiva.grupo?.nombre ?? 'Grupo'} · {claseActiva.horarioMateria?.aula?.nombre ?? 'Aula pendiente'}
              </p>
            </div>
          </div>
          <span className="self-start rounded-xl bg-card px-3 py-1.5 text-xs font-semibold text-success-foreground ring-1 ring-ring sm:self-auto">
            {claseActiva.unidadRef?.nombre ?? `Unidad ${claseActiva.unidad}`}
          </span>
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Button variant="ghost"
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-foreground dark:text-on-accent"
                : "text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-muted-foreground"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary dark:bg-card/70" />
            )}
          </Button>
        ))}
      </div>

      {tab === 'asistencias' && <TablaAsistenciasAlumno materiaId={Number(id)} />}

      {tab === 'tareas' && <TaskNotice error={error} onRetry={() => obtenerMisTareas(Number(id)).catch(() => {})} />}
      {tab === 'tareas' && (
        <div className="space-y-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : misEntregas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">Sin tareas</p>
              <p className="mt-1 text-xs text-muted-foreground">No hay tareas publicadas para esta materia.</p>
            </div>
          ) : (
            Object.entries(byUnidad).map(([unidad, items]) => (
              <div key={unidad} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{unidad}</p>
                <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
                  {items.map(({ tarea, miEntrega, estadoAlumno }) => {
                    const estado = miEntrega?.estadoRevision ?? estadoAlumno ?? null
                    const fechaLimite = formatDate(tarea.fechaLimite)
                    return (
                      <div key={tarea.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{tarea.titulo}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {tarea.unidadRef?.nombre || unidad}
                            {fechaLimite ? ` · Límite: ${fechaLimite}` : ' · Sin límite'}
                          </p>
                          {miEntrega?.observacion && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{miEntrega.observacion}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {miEntrega?.fueTardia && (
                            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning-foreground ring-1 ring-ring">
                              Tardía
                            </span>
                          )}
                          {miEntrega?.calificacion != null && (
                            <span className="text-sm font-bold text-success-foreground">
                              {miEntrega.calificacion}/100
                            </span>
                          )}
                          <EstadoTareaBadge estado={estado} />
                          <Link
                            to={`/alumno/tareas/${tarea.id}`}
                            className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-background"
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
