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
import { textoEntregas } from '@/lib/desempeno'
import { cn } from '@/lib/utils'
import api from '@/api/axios'

const FIELD = 'w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

const claveFila = (fila) => `${fila.materia.id}:${fila.grupo?.id ?? '-'}:${fila.alumno.id}`

function fechaCorta(value) {
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// Un servidor anterior solo mandaba alumnos en riesgo por asistencia.
const motivosDe = (fila) => fila.motivos ?? ['ASISTENCIA']
const porCalificacion = (motivos) => motivos.includes('CALIFICACION_BAJA')

function unidadesPorMotivo(fila, motivo) {
  return (fila.unidades ?? []).filter((unidad) => unidad.motivos?.includes(motivo))
}

function calificacionesEnRiesgo(fila) {
  return unidadesPorMotivo(fila, 'CALIFICACION_BAJA')
    .map((unidad) => unidad.calificacion == null ? unidad.nombre : `${unidad.nombre} (${unidad.calificacion})`)
    .join(' · ')
}

function borradorAviso(fila) {
  const nombre = fila.alumno.nombre.split(' ')[0]
  const motivos = motivosDe(fila)
  const frases = []
  if (motivos.includes('ASISTENCIA') && fila.registros) {
    const partes = [
      fila.faltas && `${fila.faltas} ${fila.faltas === 1 ? 'falta' : 'faltas'}`,
      fila.retardos && `${fila.retardos} ${fila.retardos === 1 ? 'retardo' : 'retardos'}`,
    ].filter(Boolean).join(' y ')
    frases.push(`llevas ${partes} de ${fila.registros} clases (${fila.porcentajeAusencias} %)`)
  }
  if (porCalificacion(motivos)) {
    const reprobadas = calificacionesEnRiesgo(fila)
    frases.push(reprobadas
      ? `tienes calificaciones reprobatorias en ${reprobadas}`
      : 'tienes una calificación reprobatoria en la materia')
  }
  if (fila.tareasSinEntregar) {
    frases.push(`tienes ${fila.tareasSinEntregar} ${fila.tareasSinEntregar === 1 ? 'tarea vencida sin entregar' : 'tareas vencidas sin entregar'}`)
  }
  const [primera = 'quiero platicar contigo sobre cómo vas', ...resto] = frases
  const soloAsistencia = motivos.length === 1 && motivos[0] === 'ASISTENCIA'
  return {
    titulo: `${soloAsistencia ? 'Tu asistencia' : 'Tu desempeño'} en ${fila.materia.nombre}`,
    cuerpo: `${nombre}, ${primera}.${resto.map((f) => ` Además, ${f}.`).join('')} Búscame para ver cómo ponerte al corriente.`,
  }
}

function SenalesRiesgo({ fila }) {
  const motivos = motivosDe(fila)
  const reprobadas = calificacionesEnRiesgo(fila)
  const faltas = unidadesPorMotivo(fila, 'ASISTENCIA').map((u) => u.nombre).join(' · ')
  const entregas = unidadesPorMotivo(fila, 'ENTREGAS').map((u) => u.nombre).join(' · ')
  return (
    <ul aria-label="Señales de riesgo" className="mt-3 space-y-1 text-sm">
      {porCalificacion(motivos) && (
        <li><span className="font-medium text-destructive-foreground">Calificación reprobatoria</span>{reprobadas && <span className="text-muted-foreground"> · {reprobadas}</span>}</li>
      )}
      {motivos.includes('ASISTENCIA') && (
        <li><span className="font-medium text-warning-foreground">Faltas y retardos</span>
          {faltas && <span className="text-muted-foreground"> · {faltas}</span>}
          {fila.porcentajeAusencias != null && <span className="text-muted-foreground"> · {fila.porcentajeAusencias} % en el periodo</span>}
        </li>
      )}
      {(motivos.includes('ENTREGAS') || fila.tareasSinEntregar > 0) && (
        <li><span className={motivos.includes('ENTREGAS') ? 'font-medium text-warning-foreground' : 'text-muted-foreground'}>
          {textoEntregas({ vencidas: fila.tareasVencidas, sinEntregar: fila.tareasSinEntregar })}
        </span>{entregas && <span className="text-muted-foreground"> · {entregas}</span>}</li>
      )}
    </ul>
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
      </div>
    )
  } else {
    contenido = (
      <ul className="space-y-3">
        {filas.map((fila) => (
          <li key={claveFila(fila)} className="rounded-[var(--radius-item)] border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{fila.alumno.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {fila.alumno.numeroControl ? `${fila.alumno.numeroControl} · ` : ''}{fila.materia.nombre}{fila.grupo ? ` · ${fila.grupo.nombre}` : ''}
                </p>
                <SenalesRiesgo fila={fila} />
                {fila.calificacion != null && (
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                    {fila.promedioHastaUnidad ? `Promedio hasta ${fila.promedioHastaUnidad}` : 'Promedio de la materia'}{' '}
                    <span className="font-semibold text-foreground">{fila.calificacion}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <Button variant="outline" onClick={() => abrirAviso(fila)} disabled={!fila.grupo}
                  title={fila.grupo ? undefined : 'Las clases sin grupo no admiten avisos'} className="min-h-11 gap-2">
                  <Megaphone className="size-4" aria-hidden="true" />{fila.ultimoAviso ? 'Avisar de nuevo' : 'Enviar aviso'}
                </Button>
                {fila.ultimoAviso && <span className="text-xs text-muted-foreground">Avisado el {fechaCorta(fila.ultimoAviso.createdAt)}</span>}
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
        </div>
        {materias.length > 1 && (
          <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground">
            Materia
            <select className={cn(FIELD, 'w-auto min-w-0 max-w-full')} value={materiaId} onChange={(event) => setMateriaId(event.target.value)}>
              <option value="">Todas</option>
              {materias.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
        )}
      </header>
      {datos?.clasesSinDatos?.length > 0 && (
        <p role="alert" className="rounded-[var(--radius-card)] border border-warning/35 bg-warning/18 px-4 py-3 text-sm text-foreground">
          No se pudo calcular {datos.clasesSinDatos.map((c) => `${c.materia.nombre} · ${c.grupo.nombre}`).join(', ')}; la lista puede estar incompleta.
        </p>
      )}
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
