import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import SexoBadge from '../../components/SexoBadge'
import TaskNotice from '../../components/TaskNotice'
import { taskError } from '../../lib/tareas'
import { useInscripcionStore } from '../../store/inscripcionStore'

export default function SolicitudesPendientes() {
  const { pendientesDocente, obtenerPendientes, aceptar, rechazar, loading, error } = useInscripcionStore()
  const [procesando, setProcesando] = useState(null)
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
  const handleRechazar = (id) => procesar(id, rechazar, 'No se pudo rechazar la solicitud. Intenta de nuevo.')

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">Solicitudes Pendientes</h1>
      {actionError && <div className="mb-4"><TaskNotice error={actionError} /></div>}
      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : error ? (
        <TaskNotice error={error} onRetry={cargar} />
      ) : pendientesDocente.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
          No hay solicitudes pendientes
        </div>
      ) : (
        <div className="space-y-3">
          {pendientesDocente.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <SexoBadge sexo={s.alumno?.sexo} />
                  {s.alumno?.nombre}
                </p>
                <p className="text-sm text-muted-foreground">
                  {s.materia?.nombre} · Periodo: {s.periodo}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('es-MX')}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="ghost"
                  onClick={() => handleAceptar(s.id)}
                  disabled={procesando === s.id}
                  className="px-4 py-2 bg-success text-success-on-fill  text-sm hover:bg-success disabled:opacity-50"
                >
                  Aceptar
                </Button>
                <Button variant="destructive"
                  onClick={() => handleRechazar(s.id)}
                  disabled={procesando === s.id}
                  className="px-4 py-2 text-sm disabled:opacity-50"
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
