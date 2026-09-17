import useAsyncAction from '@/hooks/useAsyncAction'
import { Button } from '@/components/ui/button'
import { confirmAction } from '@/lib/feedback'
import { useState } from 'react'
import { useAcademiaStore } from '../../../../store/academiaStore'

export default function ListaMateriasAcademia({ academia, onAgregarClick }) {
  const { quitarMateria } = useAcademiaStore()
  const [error, setError] = useState('')

  const handleQuitar = useAsyncAction(async (materia) => {
    if (!(await confirmAction(`¿Quitar "${materia.nombre}" de esta academia?`))) return
    setError('')
    try {
      await quitarMateria(academia.id, materia.id)
    } catch (e) {
      setError(e.message)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Materias asignadas ({academia.materias?.length ?? 0})
        </h2>
        <Button variant="default"
          onClick={onAgregarClick}
          className="px-3 py-1.5 text-xs font-medium"
        >
          + Agregar materias
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {academia.materias?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No hay materias asignadas a esta academia.
        </p>
      ) : (
        <div className="grid gap-2">
          {academia.materias?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between bg-card border border-border rounded-xl p-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{m.nombre}</p>
                <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{m.clave}</span>
                  {m.semestre && <span>• Semestre {m.semestre}</span>}
                </div>
              </div>
              <Button variant="destructive"
                onClick={() => handleQuitar(m)}
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
