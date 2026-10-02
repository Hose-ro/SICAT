import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Skeleton } from '@/components/ui/skeleton'
import Modal from '@/components/Modal'
import TaskNotice from '@/components/TaskNotice'
import { notify } from '@/lib/feedback'
import { mensajeError } from '@/lib/avisos'
import { cn } from '@/lib/utils'
import api from '@/api/axios'

const ESTADO = {
  ASISTENCIA: { letra: 'A', label: 'Asistió', className: 'bg-success/15 text-success-foreground' },
  FALTA: { letra: 'F', label: 'Falta', className: 'bg-destructive/15 text-destructive-foreground' },
  RETARDO: { letra: 'R', label: 'Retardo', className: 'bg-warning/20 text-warning-foreground' },
  JUSTIFICADA: { letra: 'J', label: 'Justificada', className: 'bg-muted text-muted-foreground' },
}

const FIELD = 'w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

const claveFila = (fila) => `${fila.materia.id}:${fila.grupo?.id ?? '-'}:${fila.alumno.id}`

function fechaCorta(value) {
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function borradorAviso(fila) {
  const nombre = fila.alumno.nombre.split(' ')[0]
  const partes = [
    fila.faltas && `${fila.faltas} ${fila.faltas === 1 ? 'falta' : 'faltas'}`,
    fila.retardos && `${fila.retardos} ${fila.retardos === 1 ? 'retardo' : 'retardos'}`,
  ].filter(Boolean).join(' y ')
  const tareas = fila.tareasSinEntregar
    ? ` Además, tienes ${fila.tareasSinEntregar} ${fila.tareasSinEntregar === 1 ? 'tarea vencida sin entregar' : 'tareas vencidas sin entregar'}.`
    : ''
  return {
    titulo: `Tu asistencia en ${fila.materia.nombre}`,
    cuerpo: `${nombre}, llevas ${partes} de ${fila.registros} clases (${fila.porcentajeAusencias} %).${tareas} Búscame para ver cómo ponerte al corriente.`,
  }
}

function Tendencia({ estados }) {
  return (
    <span className="flex gap-1" aria-label={`Últimas clases: ${estados.map((e) => ESTADO[e]?.label ?? e).join(', ')}`}>
      {estados.map((estado, indice) => (
        <span key={indice} aria-hidden="true"
          className={cn('grid size-6 place-items-center rounded-md text-xs font-semibold', ESTADO[estado]?.className)}>
          {ESTADO[estado]?.letra ?? '?'}
        </span>
      ))}
    </span>
  )
}

/**
 * Alumnos que el panel cuenta como "en riesgo", con lo necesario para actuar
 * y un aviso individual que queda registrado como "ya se le avisó".
 */
export default function AlumnosRiesgo() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [materiaId, setMateriaId] = useState('')
  const [avisando, setAvisando] = useState(null)
  const [borrador, setBorrador] = useState({ titulo: '', cuerpo: '' })
  const [enviando, setEnviando] = useState(false)

  const cargar = () => api.get('/dashboard/docente/riesgo')
    .then((res) => { setDatos(res.data); setError('') })
    .catch((err) => setError(mensajeError(err, 'No se pudo cargar la lista de alumnos en riesgo.')))

  useEffect(() => { cargar() }, [])

  const materias = useMemo(() => {
    const mapa = new Map((datos?.alumnos ?? []).map((fila) => [fila.materia.id, fila.materia.nombre]))
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [datos])
  const filas = (datos?.alumnos ?? []).filter((fila) => !materiaId || fila.materia.id === Number(materiaId))

  const abrirAviso = (fila) => {
    setBorrador(borradorAviso(fila))
    setAvisando(fila)
  }

  const enviar = async (event) => {
    event.preventDefault()
    if (enviando || !borrador.titulo.trim() || !borrador.cuerpo.trim()) return
    setEnviando(true)
    try {
      const { data } = await api.post('/avisos', {
        materiaId: avisando.materia.id,
        grupoId: avisando.grupo.id,
        alumnoId: avisando.alumno.id,
        ...borrador,
      })
      const clave = claveFila(avisando)
      setDatos((prev) => ({
        ...prev,
        alumnos: prev.alumnos.map((fila) => (claveFila(fila) === clave
          ? { ...fila, ultimoAviso: { id: data.id, titulo: data.titulo, createdAt: data.createdAt } }
          : fila)),
      }))
      notify(`Le avisaste a ${avisando.alumno.nombre}.`, 'success')
      setAvisando(null)
    } catch (err) {
      notify(mensajeError(err, 'No se pudo enviar el aviso.'))
    } finally {
      setEnviando(false)
    }
  }

  let contenido
  if (error) {
    contenido = <TaskNotice error={error} onRetry={cargar} />
  } else if (!datos) {
    contenido = (
      <div role="status" aria-label="Cargando alumnos en riesgo" className="space-y-3">
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  } else if (!datos.alumnos.length) {
    contenido = (
      <div className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">Ningún alumno está en riesgo por ahora.</p>
        <p className="mt-1 text-sm text-muted-foreground">La lista se arma con la asistencia que registras en cada clase.</p>
      </div>
    )
  } else {
    contenido = (
      <ul className="space-y-3">
        {filas.map((fila) => (
          <li key={claveFila(fila)} className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
            <div className="grid gap-4 @container sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{fila.alumno.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {fila.alumno.numeroControl ? `${fila.alumno.numeroControl} · ` : ''}{fila.materia.nombre}{fila.grupo ? ` · ${fila.grupo.nombre}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span>
                    <span className="text-lg font-semibold tabular-nums text-destructive-foreground">{fila.porcentajeAusencias} %</span>
                    <span className="ml-1.5 text-muted-foreground">
                      {fila.faltas} F · {fila.retardos} R de {fila.registros} clases
                    </span>
                  </span>
                  <Tendencia estados={fila.tendencia} />
                  <span className={fila.tareasSinEntregar ? 'text-warning-foreground' : 'text-muted-foreground'}>
                    {fila.tareasVencidas
                      ? `${fila.tareasSinEntregar} de ${fila.tareasVencidas} tareas vencidas sin entregar`
                      : 'Sin tareas vencidas'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <Button variant={fila.ultimoAviso ? 'outline' : 'default'} onClick={() => abrirAviso(fila)} disabled={!fila.grupo}
                  title={fila.grupo ? undefined : 'Las clases sin grupo no admiten avisos'} className="gap-2">
                  <Megaphone className="size-4" aria-hidden="true" />{fila.ultimoAviso ? 'Avisar de nuevo' : 'Enviar aviso'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {fila.ultimoAviso ? `Avisado el ${fechaCorta(fila.ultimoAviso.createdAt)}` : 'Aún sin avisar'}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto max-w-[60rem] space-y-5">
      <Link to="/dashboard" className={cn(buttonVariants({ variant: 'ghost' }), 'h-9 gap-2 px-2')}>
        <ArrowLeft className="size-4" aria-hidden="true" />Inicio
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Alumnos en riesgo</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {datos?.criterio
              ? `Con ${datos.criterio.porcentaje} % o más de faltas y retardos y al menos ${datos.criterio.minRegistros} clases registradas en el periodo.`
              : 'Faltas y retardos del periodo en curso.'}
          </p>
        </div>
        {materias.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Materia
            <select className={`${FIELD} w-auto`} value={materiaId} onChange={(event) => setMateriaId(event.target.value)}>
              <option value="">Todas</option>
              {materias.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
        )}
      </header>
      {contenido}

      {avisando && (
        <Modal open onClose={() => setAvisando(null)} busy={enviando} title={`Aviso para ${avisando.alumno.nombre}`}
          description="Sólo lo recibe este alumno. Queda registrado que se le avisó.">
          <form onSubmit={enviar} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Título</span>
              <input className={FIELD} maxLength={120} value={borrador.titulo}
                onChange={(event) => setBorrador((prev) => ({ ...prev, titulo: event.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Mensaje</span>
              <textarea className={FIELD} rows={5} maxLength={2000} value={borrador.cuerpo}
                onChange={(event) => setBorrador((prev) => ({ ...prev, cuerpo: event.target.value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setAvisando(null)} disabled={enviando}>Cancelar</Button>
              <Button type="submit" disabled={enviando || !borrador.titulo.trim() || !borrador.cuerpo.trim()}>
                {enviando ? 'Enviando…' : 'Enviar aviso'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
