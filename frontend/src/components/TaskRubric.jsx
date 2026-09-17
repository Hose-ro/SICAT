import { Button } from '@/components/ui/button'
export default function TaskRubric({ value, onChange }) {
  let rows
  try { rows = value ? JSON.parse(value) : [] } catch { rows = null }
  const compatible = Array.isArray(rows) && rows.every((row) => row && typeof row.criterio === 'string' && 'peso' in row && Object.keys(row).every((key) => ['criterio', 'peso'].includes(key)))
  if (!compatible) return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Esta tarea usa una rúbrica con un formato anterior. Se conservará al guardar los cambios.</p>
      <Button variant="ghost" type="button" onClick={() => onChange('[]')} className="font-semibold text-primary-ink underline">Reemplazar por una rúbrica de criterios y porcentajes</Button>
    </div>
  )
  const update = (index, patch) => onChange(JSON.stringify(rows.map((row, i) => i === index ? { ...row, ...patch } : row)))
  const total = rows.reduce((sum, row) => sum + Number(row.peso || 0), 0)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Agrega lo que evaluarás y su porcentaje. El total debe sumar 100%.</p>
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border p-3">
          <label className="block text-sm">Criterio {index + 1}
            <input required value={row.criterio} onChange={(event) => update(index, { criterio: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background p-2" placeholder="Ej. Claridad de la explicación" />
          </label>
          <div className="flex items-end gap-3">
            <label className="min-w-0 flex-1 text-sm">Porcentaje
              <input required type="number" min="1" max="100" value={row.peso} onChange={(event) => update(index, { peso: event.target.value === '' ? '' : Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-input bg-background p-2" />
            </label>
            <Button variant="destructive" type="button" aria-label={`Quitar criterio ${index + 1}`} onClick={() => onChange(JSON.stringify(rows.filter((_, i) => i !== index)))} className="p-2 text-sm">Quitar</Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" type="button" onClick={() => onChange(JSON.stringify([...rows, { criterio: '', peso: '' }]))} className="border px-3 py-2 text-sm font-semibold">Agregar criterio</Button>
        <span aria-live="polite" className="text-sm font-semibold">Total: {total}%</span>
      </div>
    </div>
  )
}
