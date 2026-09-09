export default function TaskCriteria({ tarea }) {
  if (tarea.tipoEvaluacion !== 'RUBRICA' || !tarea.rubricJson) return null
  let rows
  try { rows = JSON.parse(tarea.rubricJson) } catch { return null }
  if (!Array.isArray(rows) || !rows.every((row) => row && typeof row.criterio === 'string' && Number.isFinite(Number(row.peso)))) return null
  return <section className="rounded-2xl border border-border bg-card p-5">
    <h2 className="font-semibold">Criterios de evaluación</h2>
    <ul className="mt-3 divide-y divide-border text-sm">
      {rows.map((row, index) => <li key={index} className="flex justify-between gap-4 py-2"><span>{row.criterio}</span><span className="font-semibold">{row.peso}%</span></li>)}
    </ul>
  </section>
}
