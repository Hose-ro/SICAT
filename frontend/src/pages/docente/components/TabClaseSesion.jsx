import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/feedback'
import { confirmAction } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { useClaseStore } from '../../../store/claseStore'

export default function TabClaseSesion({ materiaId }) {
  const { sesionActiva, historial, iniciar, finalizar, obtenerActiva, obtenerHistorial, loading } = useClaseStore()
  const [unidad, setUnidad] = useState(1)

  useEffect(() => {
    obtenerActiva(materiaId)
    obtenerHistorial(materiaId)
  }, [materiaId, obtenerActiva, obtenerHistorial])

  const handleIniciar = async () => {
    try { await iniciar(materiaId, unidad) } catch (e) { notify(e.message) }
  }

  const handleFinalizar = useAsyncAction(async () => {
    if (!(await confirmAction({ title: 'Finalizar clase', description: 'La clase se cerrará y los alumnos sin captura quedarán como falta. Comprueba la lista antes de continuar.', confirmLabel: 'Finalizar clase' }))) return
    try { await finalizar(sesionActiva.id) } catch (e) { notify(e.message) }
  })

  return (
    <div className="space-y-4">
      {sesionActiva ? (
        <div className="bg-success/10 border border-success/30 rounded-lg p-4">
          <p className="font-semibold text-success-foreground">Clase activa - Unidad {sesionActiva.unidad}</p>
          <p className="text-sm text-success-foreground">Iniciada: {new Date(sesionActiva.horaInicio).toLocaleTimeString('es-MX')}</p>
          <Button variant="destructive" onClick={handleFinalizar} disabled={loading}
            className="mt-3 px-4 py-2 text-sm">
            Finalizar Clase
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <select aria-label="Unidad" value={unidad} onChange={(e) => setUnidad(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm">
            {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
          </select>
          <Button variant="default" onClick={handleIniciar} disabled={loading}
            className="px-4 py-2 text-sm">
            Iniciar Clase
          </Button>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-2">Historial de clases</h2>
        {historial.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin clases registradas</p>
        ) : (
          <div className="space-y-2">
            {historial.map((s) => (
              <div key={s.id} className="bg-card border rounded p-3 flex justify-between items-center">
                <div>
                  <span className="font-medium text-sm">Unidad {s.unidad}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(s.fecha).toLocaleDateString('es-MX')}</span>
                </div>
                <span className="text-xs text-muted-foreground">{s._count?.asistencias ?? 0} registros</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
