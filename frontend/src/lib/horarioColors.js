const COLORES = [
  'bg-schedule-1',
  'bg-schedule-2',
  'bg-schedule-3',
  'bg-schedule-4',
  'bg-schedule-5',
  'bg-schedule-6',
  'bg-schedule-7',
  'bg-schedule-8',
]

export function colorParaMateria(index) {
  return COLORES[index % COLORES.length]
}


export const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

export function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function horasSemanales(horarios) {
  return horarios.reduce((acc, horario) => {
    const h = (aMinutos(horario.horaFin) - aMinutos(horario.horaInicio)) / 60
    return acc + h * horario.dias.split(',').length
  }, 0)
}

/** Índice en DIAS del día de hoy (domingo cae en lunes). */
export function diaDeHoy(fecha = new Date()) {
  const dia = fecha.getDay()
  return dia >= 1 && dia <= 6 ? dia - 1 : 0
}
