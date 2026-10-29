const valorCorto = (valor) => (typeof valor === 'number' ? String(Number(valor.toFixed(1))) : '—')

// "Examen 85 (40 %) · Prácticas 60 (30 %) · Asistencia 90 (10 %)": de dónde
// sale la calificación cuando el grupo tiene criterios propios. Vacío con la
// ponderación predeterminada (todas las tareas por igual más la asistencia).
export function desglosePorCategoria(row) {
  if (row?.criterios?.length && row.origenCriterios && row.origenCriterios !== 'PREDETERMINADA') {
    return row.criterios
      .map((item) => `${item.nombre} ${valorCorto(item.valor)} (${item.peso} %)`)
      .join(' · ')
  }
  if (!row?.promedioPorCategoria?.length) return ''
  return row.promedioPorCategoria
    .map((item) => `${item.nombre} ${valorCorto(item.promedio)}`)
    .join(' · ')
}
