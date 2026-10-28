import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import SexoBadge from '../../components/SexoBadge'
import TaskNotice from '../../components/TaskNotice'
import { taskError } from '../../lib/tareas'
import { useInscripcionStore } from '../../store/inscripcionStore'

export default function SolicitudesPendientes() {
  const { pendientesDocente, obtenerPendientes, aceptar, rechazar, loading, error } = useInscripcionStore()
  const [procesando, setProcesando] = useState(null)
  const [aceptandoTodas, setAceptandoTodas] = useState(false)
  const [actionError, setActionError] = useState('')

  // El store guarda el error; aquí sólo evitamos el rechazo sin manejar.
  const cargar = () => obtenerPendientes().catch(() => {})
  useEffect(() => { obtenerPendientes().catch(() => {}) }, [obtenerPendientes])

  const procesar = async (id, accion, fallback) => {
    setProcesando(id)
    setActionError('')
    try { await accion(id) } catch (err) { setActionError(taskError(err, fallback)) } finally { setProcesando(null) }
  }
  const handleAceptar = (id) => procesar(id, aceptar, 'No se pudo aceptar la solicitud. Intenta de nuevo.')
  // Una por una: si alguna falla, las demás siguen y la fallida queda en la lista.
  const aceptarTodas = async () => {
    const lista = [...pendientesDocente]
    if (!(await confirmAction({
      title: `Aceptar ${lista.length} solicitudes`,
      description: 'Todos estos alumnos quedarán inscritos en la materia que pidieron.',
      confirmLabel: 'Aceptar todas',
    }))) return
    setAceptandoTodas(true)
    setActionError('')
    let fallidas = 0
    for (const solicitud of lista) {
      try { await aceptar(solicitud.id) } catch { fallidas += 1 }
    }
    setAceptandoTodas(false)
    if (fallidas === 1) setActionError('No se pudo aceptar 1 solicitud. Sigue en la lista; intenta de nuevo.')
    else if (fallidas > 1) setActionError(`No se pudieron aceptar ${fallidas} solicitudes. Siguen en la lista; intenta de nuevo.`)
  }

  const handleRechazar = async (solicitud) => {
    if (!(await confirmAction({
      title: 'Rechazar solicitud',
      description: `${solicitud.alumno?.nombre ?? 'El alumno'} no quedará inscrito en ${solicitud.materia?.nombre ?? 'la materia'} y recibirá un aviso del rechazo.`,
      confirmLabel: 'Rechazar',
    }))) return
    procesar(solicitud.id, rechazar, 'No se pudo rechazar la solicitud. Intenta de nuevo.')
  }

  return (
    <div className="mx-auto max-w-[60rem]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Solicitudes de inscripción</h1>
          {!loading && pendientesDocente.length > 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {pendientesDocente.length === 1 ? '1 alumno espera' : `${pendientesDocente.length} alumnos esperan`} respuesta.
            </p>
          )}
        </div>
        {pendientesDocente.length > 1 && (
          <Button variant="outline" onClick={aceptarTodas} disabled={aceptandoTodas || procesando !== null}>
            {aceptandoTodas ? 'Aceptando…' : 'Aceptar todas'}
          </Button>
        )}
      </header>
      {actionError && <div className="mb-4"><TaskNotice error={actionError} /></div>}
      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : error ? (
        <TaskNotice error={error} onRetry={cargar} />
      ) : pendientesDocente.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No hay solicitudes por revisar.
        </div>
      ) : (
        <div className="space-y-3">
          {pendientesDocente.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-[var(--radius-item)] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <SexoBadge sexo={s.alumno?.sexo} />
                  {s.alumno?.nombre}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[s.alumno?.numeroControl, s.materia?.nombre, s.periodo].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pidió entrar el {new Date(s.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="outline"
                  onClick={() => handleAceptar(s.id)}
                  disabled={procesando === s.id || aceptandoTodas}
                  className="px-4"
                >
                  Aceptar
                </Button>
                <Button variant="ghost"
                  onClick={() => handleRechazar(s)}
                  disabled={procesando === s.id || aceptandoTodas}
                  className="px-4 text-destructive-foreground hover:bg-destructive/18 hover:text-destructive-foreground"
                >
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
