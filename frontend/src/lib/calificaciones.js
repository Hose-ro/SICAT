// "Examen 100 · Prácticas 60": de dónde sale el promedio de tareas cuando el
// grupo pondera por categoría. Vacío si promedia todas por igual.
export function desglosePorCategoria(row) {
  if (!row?.promedioPorCategoria?.length) return ''
  return row.promedioPorCategoria
    .map((item) => `${item.nombre} ${typeof item.promedio === 'number' ? item.promedio : '—'}`)
    .join(' · ')
}
