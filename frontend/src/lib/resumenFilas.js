// Resumen de las filas (alumno × unidad) de un reporte de calificaciones, con
// las reglas de SICAT. Lo usan la jefatura y el panel del docente.

/** Igual que Calificaciones: promedio simple de las unidades con número, a un decimal. */
export function promedio(values) {
  const numeros = values.filter((value) => typeof value === 'number')
  return numeros.length ? Number((numeros.reduce((suma, value) => suma + value, 0) / numeros.length).toFixed(1)) : null
}

/** Calificación de una unidad: real si la unidad cerró o el docente la capturó, provisional si sigue abierta. */
export function tipoCalificacion(row) {
  if (row?.calificacionFinal == null) return 'SIN_CAPTURA'
  if (row.unidad?.status === 'FINALIZADA' || row.calificacionManual != null) return 'REAL'
  return 'PROVISIONAL'
}

/** Filas (alumno × unidad) de un alumno en un reporte, resumidas con las reglas de SICAT. */
export function resumenAlumno(rows) {
  const notas = rows.map((r) => r.calificacionFinal)
  const tipos = rows.map(tipoCalificacion)
  const asistencia = rows.reduce((a, r) => ({
    registradas: a.registradas + (r.asistencia?.registradas ?? 0),
    asistencias: a.asistencias + (r.asistencia?.asistencias ?? 0),
    faltas: a.faltas + (r.asistencia?.faltas ?? 0),
    retardos: a.retardos + (r.asistencia?.retardos ?? 0),
    justificadas: a.justificadas + (r.asistencia?.justificadas ?? 0),
  }), { registradas: 0, asistencias: 0, faltas: 0, retardos: 0, justificadas: 0 })
  const tareas = rows.reduce((a, r) => ({
    total: a.total + (r.tareas?.total ?? 0),
    entregadas: a.entregadas + (r.tareas?.entregadas ?? 0),
    vencidas: a.vencidas + (r.tareas?.vencidas ?? 0),
    vencidasSinEntregar: a.vencidasSinEntregar + (r.tareas?.vencidasSinEntregar ?? 0),
  }), { total: 0, entregadas: 0, vencidas: 0, vencidasSinEntregar: 0 })
  const valor = promedio(notas)
  return {
    promedio: valor,
    tipo: valor == null ? 'SIN_CAPTURA' : tipos.every((t) => t === 'REAL') ? 'REAL' : 'PROVISIONAL',
    calificadas: tipos.filter((t) => t !== 'SIN_CAPTURA').length,
    unidades: rows.length,
    asistencia: { ...asistencia, porcentaje: asistencia.registradas ? Math.round((asistencia.asistencias / asistencia.registradas) * 100) : null },
    // Porcentaje entregado de lo ya vencido: lo que aún no vence no cuenta.
    tareas: { ...tareas, porcentaje: tareas.vencidas ? Math.round(((tareas.vencidas - tareas.vencidasSinEntregar) / tareas.vencidas) * 100) : null },
    motivos: [...new Set(rows.flatMap((r) => r.motivos ?? []))],
    observaciones: rows.filter((r) => r.observacionManual).map((r) => ({ unidad: r.unidad?.nombre, texto: r.observacionManual })),
  }
}
