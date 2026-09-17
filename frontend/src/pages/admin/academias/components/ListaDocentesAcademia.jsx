import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useState } from 'react'
import { useAcademiaStore } from '../../../../store/academiaStore'

export default function ListaDocentesAcademia({ academia, onAgregarClick }) {
  const { quitarDocente } = useAcademiaStore()
  const [error, setError] = useState('')

  const handleQuitar = useAsyncAction(async (docente) => {
    if (!(await confirmAction(`¿Quitar a "${docente.nombre}" de esta academia?`))) return
    setError('')
    try {
      await quitarDocente(academia.id, docente.id)
    } catch (e) {
      setError(e.message)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Docentes asignados ({academia.docentes?.length ?? 0})
        </h2>
        <Button variant="default"
          onClick={onAgregarClick}
          className="px-3 py-1.5 text-xs font-medium"
        >
          + Agregar docentes
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {academia.docentes?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No hay docentes asignados a esta academia.
        </p>
      ) : (
        <div className="grid gap-2">
          {academia.docentes?.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between bg-card border border-border rounded-xl p-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent text-primary-ink flex items-center justify-center text-sm font-bold">
                  {d.nombre[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{d.nombre}</p>
                  {d.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
                </div>
              </div>
              <Button variant="destructive"
                onClick={() => handleQuitar(d)}
                className="text-xs px-2 py-1"
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
