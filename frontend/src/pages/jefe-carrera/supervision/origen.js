// Origen de un recorrido transversal (?desde=): una dirección interna de la
// jefatura a la que «Volver» regresa con sus filtros. Nunca una URL externa.

const MAX_DESDE = 1200

const DESTINOS = [
  [/^\/dashboard$/, 'Volver a Inicio'],
  [/^\/jefe-carrera\/seguimientos$/, 'Volver a Pendientes y seguimiento'],
  [/^\/jefe-carrera\/horarios$/, 'Volver a Horarios'],
  [/^\/jefe-carrera\/grupos$/, 'Volver a Grupos y alumnos'],
  [/^\/jefe-carrera\/grupos\/\d+$/, 'Volver al grupo'],
  [/^\/jefe-carrera\/docentes$/, 'Volver a Docentes'],
  [/^\/jefe-carrera\/docentes\/\d+$/, 'Volver al docente'],
  [/^\/jefe-carrera\/materias$/, 'Volver a Materias'],
  [/^\/jefe-carrera\/materias\/\d+$/, 'Volver a la materia'],
  [/^\/jefe-carrera\/reportes$/, 'Volver a Informes'],
]

/**
 * Valida el origen: ruta conocida, sin esquema ni host, y con la misma carrera
 * y periodo que la vista actual (un enlace compartido de otra carrera no debe
 * llevar a ella). Devuelve { to, label } o null para usar el listado.
 */
export function leerOrigen(desde, { carreraId, periodo }) {
  if (!desde || desde.length > MAX_DESDE || !desde.startsWith('/') || desde.startsWith('//') || /[\\\s]/.test(desde)) return null
  const [ruta, query = ''] = desde.split('?')
  const destino = DESTINOS.find(([patron]) => patron.test(ruta))
  if (!destino) return null
  const params = new URLSearchParams(query)
  if (params.get('carrera') !== String(carreraId) || params.get('periodo') !== periodo) return null
  return { to: desde, label: destino[1] }
}

/**
 * Dirección actual para usarla como origen. Si ya trae su propio origen se
 * conserva (volver encadena), salvo que la cadena crezca demasiado.
 */
export function origenActual(pathname, search) {
  const actual = `${pathname}${search}`
  if (actual.length <= MAX_DESDE) return actual
  const params = new URLSearchParams(search)
  params.delete('desde')
  return `${pathname}?${params}`
}
