import { Button } from '@/components/ui/button'
import { useState } from 'react'
import SexoBadge from '../../../../components/SexoBadge'
import { useGrupoStore } from '../../../../store/grupoStore'

export default function TabAlumnos({ grupo, onAgregarClick }) {
  const { quitarAlumno } = useGrupoStore()
  const [confirmId, setConfirmId] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleQuitar = async (alumnoId) => {
    setLoading(true)
    try {
      await quitarAlumno(grupo.id, alumnoId)
    } finally {
      setLoading(false)
      setConfirmId(null)
    }
  }

  const alumnos = grupo?.alumnos ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{alumnos.length} alumno(s)</p>
        <Button variant="default"
          onClick={onAgregarClick}
          className="w-full px-4 py-2 text-sm sm:w-auto"
        >
          + Agregar alumnos
        </Button>
      </div>

      {alumnos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No hay alumnos asignados</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Alumnos del grupo">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-background text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Número de control</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Sexo</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alumnos.map((a) => (
                <tr key={a.id} className="hover:bg-background">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{a.numeroControl ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{a.nombre}</td>
                  <td className="px-4 py-3">
                    {a.sexo ? <SexoBadge sexo={a.sexo} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {confirmId === a.id ? (
                      <span className="flex flex-wrap justify-end gap-2">
                        <Button variant="destructive"
                          onClick={() => handleQuitar(a.id)}
                          disabled={loading}
                          className="text-xs px-3 py-1 disabled:opacity-50"
                        >
                          Confirmar
                        </Button>
                        <Button variant="ghost"
                          onClick={() => setConfirmId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground px-2"
                        >
                          Cancelar
                        </Button>
                      </span>
                    ) : (
                      <Button variant="destructive"
                        onClick={() => setConfirmId(a.id)}
                        className="text-xs"
                      >
                        Quitar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
