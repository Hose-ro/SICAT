export function getCurrentAcademicPeriod(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() + 1
  const suffix = month <= 6 ? 'A' : 'B'
  return `${year}-${suffix}`
}

/** `YYYY-MM-DD` leído en hora local; `new Date(clave)` lo correría a UTC. */
export function fechaDeClave(clave) {
  const [anio, mes, dia] = clave.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/** La clave `YYYY-MM-DD` de una fecha, en hora local. */
export function claveDeFecha(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}
