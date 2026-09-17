import { Button } from '@/components/ui/button'
import { useId, useMemo, useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

export default function SelectorGrupo() {
  const fieldId = useId()
  const {
    grupos,
    seleccionarGrupo,
    grupoSeleccionado,
  } = useHorarioStore()

  const [busquedaEditada, setBusqueda] = useState(null)
  const [abierto, setAbierto] = useState(false)

  const busqueda = busquedaEditada ?? grupoSeleccionado?.nombre ?? ''

  const filtrados = useMemo(() => {
    const query = busqueda.toLowerCase()
    return grupos.filter((g) => {
      const nombre = g.nombre?.toLowerCase() || ''
      const carrera = g.carrera?.nombre?.toLowerCase() || ''
      return nombre.includes(query) || carrera.includes(query)
    })
  }, [grupos, busqueda])

  async function handleSelect(grupo) {
    setBusqueda(null)
    setAbierto(false)
    await seleccionarGrupo(grupo.id)
  }


  return (
    <div className="relative">
      <label htmlFor={fieldId + '-control-40'} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
        Grupo
      </label>
      <input id={fieldId + '-control-40'}
        type="text"
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar grupo (101A, 2026-A)"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtrados.map((g) => (
            <Button variant="ghost" size="row"
              key={g.id}
              onClick={() => handleSelect(g)}
              className="px-3 py-2 text-sm hover:bg-background"
            >
              <p className="font-medium">{g.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {g.carrera?.nombre ?? 'Sin carrera'} · Sem {g.semestre} · {g.periodo}
              </p>
            </Button>
          ))}
        </div>
      )}
      {grupoSeleccionado && (
        <p className="mt-1 text-xs text-muted-foreground">Mostrando horario de {grupoSeleccionado.nombre}</p>
      )}
    </div>
  )
}
