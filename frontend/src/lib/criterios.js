import {
  ClipboardList,
  FileCheck2,
  FlaskConical,
  FolderKanban,
  Hand,
  Presentation,
  Shapes,
  UserCheck,
} from 'lucide-react'

// Lo que mide cada tipo de criterio. Los de actividad promedian las tareas,
// exámenes o prácticas que lo llevan; `entrega` es cómo se entrega por defecto
// una actividad nueva de ese tipo. Asistencia y participación salen del pase
// de lista.
export const TIPOS_CRITERIO = {
  EXAMEN: { label: 'Examen', singular: 'Examen', icono: FileCheck2, entrega: 'PRESENCIAL', actividad: true },
  PRACTICAS: { label: 'Prácticas', singular: 'Práctica', icono: FlaskConical, entrega: 'EN_LINEA', actividad: true },
  TAREAS: { label: 'Tareas', singular: 'Tarea', icono: ClipboardList, entrega: 'EN_LINEA', actividad: true },
  PROYECTO: { label: 'Proyecto', singular: 'Proyecto', icono: FolderKanban, entrega: 'EN_LINEA', actividad: true },
  EXPOSICION: { label: 'Exposición', singular: 'Exposición', icono: Presentation, entrega: 'PRESENCIAL', actividad: true },
  OTRO: { label: 'Otro', singular: 'Actividad', icono: Shapes, entrega: 'EN_LINEA', actividad: true },
  ASISTENCIA: { label: 'Asistencia', icono: UserCheck, actividad: false, ayuda: 'Del pase de lista' },
  PARTICIPACION: { label: 'Participación', icono: Hand, actividad: false, ayuda: 'Puntos contra una meta' },
}

export const TIPOS_PLANTILLA = ['EXAMEN', 'PRACTICAS', 'TAREAS', 'PROYECTO', 'EXPOSICION', 'PARTICIPACION', 'ASISTENCIA', 'OTRO']

export const MAX_CRITERIOS = 12
export const META_POR_DEFECTO = 5
export const META_MAXIMA = 100

export const esDeActividad = (tipo) => Boolean(TIPOS_CRITERIO[tipo]?.actividad)
export const tipoCriterio = (tipo) => TIPOS_CRITERIO[tipo] ?? TIPOS_CRITERIO.OTRO

/** Lista que rige en una unidad: la propia si la tiene; si no, la de todas. */
export function listaEfectiva(datos, unidadId) {
  if (!datos) return []
  const propia = unidadId
    ? datos.unidades?.find((item) => item.unidad.id === Number(unidadId))
    : null
  return propia?.personalizada ? propia.criterios ?? [] : datos.base?.criterios ?? []
}

/** Criterios de actividad de esa lista (los que puede llevar una tarea). */
export function criteriosDeActividad(datos, unidadId) {
  return listaEfectiva(datos, unidadId).filter((criterio) => esDeActividad(criterio.tipo) && criterio.id)
}

export function normalizarNombre(nombre = '') {
  return String(nombre).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export const sumaPesos = (criterios) =>
  criterios.reduce((suma, item) => suma + (Number.parseInt(item.peso, 10) || 0), 0)

const esEntero = (valor, minimo, maximo) =>
  /^\d+$/.test(String(valor)) && Number(valor) >= minimo && Number(valor) <= maximo

/** Mismas reglas que el servidor. Devuelve el primer problema o ''. */
export function validarCriterios(criterios) {
  if (!criterios.length) return 'Agrega al menos un criterio.'
  if (criterios.length > MAX_CRITERIOS) return `Puedes tener hasta ${MAX_CRITERIOS} criterios.`
  const nombres = criterios.map((item) => normalizarNombre(item.nombre))
  if (nombres.some((nombre) => !nombre)) return 'Cada criterio necesita un nombre.'
  if (new Set(nombres).size !== nombres.length) return 'Hay criterios con el mismo nombre.'
  if (criterios.filter((item) => item.tipo === 'ASISTENCIA').length > 1) return 'La asistencia sólo puede aparecer una vez.'
  if (criterios.filter((item) => item.tipo === 'PARTICIPACION').length > 1) return 'La participación sólo puede aparecer una vez.'
  if (criterios.some((item) => !esEntero(item.peso, 1, 100))) return 'Cada criterio pesa entre 1 y 100 %.'
  const suma = sumaPesos(criterios)
  if (suma !== 100) return `Los criterios deben sumar 100 % (ahora suman ${suma} %).`
  if (criterios.some((item) => item.tipo === 'PARTICIPACION' && !esEntero(item.meta, 1, META_MAXIMA))) {
    return `Pon la meta de participación: de 1 a ${META_MAXIMA} participaciones por unidad.`
  }
  return ''
}

/** "Examen 40 % · Prácticas 30 % · Asistencia 10 %" */
export function resumenCriterios(criterios = []) {
  return criterios.map((item) => `${item.nombre} ${item.peso} %`).join(' · ')
}
