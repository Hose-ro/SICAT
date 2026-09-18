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

export const MODALIDADES = ['ESCOLARIZADO', 'MIXTO']

export const ETIQUETA_MODALIDAD = {
  ESCOLARIZADO: 'Escolarizado',
  MIXTO: 'Mixto',
}

/**
 * Modalidad de un bloque de horario: la de su grupo. Sin grupo se decide por
 * el día, porque sólo los mixtos tienen clase en sábado.
 */
export function modalidadDeHorario(horario) {
  if (horario?.grupo?.modalidad) return horario.grupo.modalidad
  const dias = (horario?.dias ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return dias.includes('sabado') ? 'MIXTO' : 'ESCOLARIZADO'
}

/** Calendario (`escolarizado` o `mixto`) que le toca a un horario. */
export function periodoDeHorario(periodos, horario) {
  if (!periodos) return null
  return modalidadDeHorario(horario) === 'MIXTO' ? periodos.mixto : periodos.escolarizado
}

/** Un semestre mixto son 16 sábados de clase. */
export const SABADOS_POR_SEMESTRE = 16

export function esSabado(clave) {
  return Boolean(clave) && fechaDeClave(clave).getDay() === 6
}

/** Fin propuesto para un semestre mixto: el sábado 16 contando el de inicio. */
export function finMixtoSugerido(inicioClave) {
  if (!inicioClave) return ''
  const fin = fechaDeClave(inicioClave)
  fin.setDate(fin.getDate() + (SABADOS_POR_SEMESTRE - 1) * 7)
  return claveDeFecha(fin)
}
