// Fechas como claves locales AAAA-MM-DD, igual que el backend de supervisión.
const pad = (n) => String(n).padStart(2, '0')

export const claveFecha = (fecha) => `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
export const hoyClave = () => claveFecha(new Date())

export function parseClave(clave) {
  const [y, m, d] = clave.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function sumarDias(clave, dias) {
  const fecha = parseClave(clave)
  fecha.setDate(fecha.getDate() + dias)
  return claveFecha(fecha)
}

export const diaSemana = (clave) => parseClave(clave).getDay()

export function lunesDe(clave) {
  return sumarDias(clave, -((diaSemana(clave) + 6) % 7))
}

export const esClaveValida = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export const fechaLarga = (clave) =>
  parseClave(clave).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const fechaCorta = (clave) =>
  parseClave(clave).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })

export const diaCorto = (clave) => {
  const fecha = parseClave(clave)
  return `${fecha.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')} ${fecha.getDate()}`
}

export function rangoTexto(desde, hasta) {
  if (desde === hasta) return fechaLarga(desde)
  const a = parseClave(desde)
  const b = parseClave(hasta)
  const mes = (fecha) => fecha.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
  return `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`
}

export function minutos(hora) {
  const [h, m] = String(hora).split(':').map(Number)
  return h * 60 + (m || 0)
}

export const horaCorta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

export function haceTiempo(clave) {
  const dias = Math.round((parseClave(hoyClave()) - parseClave(clave)) / 86400000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  const semanas = Math.floor(dias / 7)
  return semanas === 1 ? 'Hace 1 semana' : `Hace ${semanas} semanas`
}

export function fechaHoraCorta(iso) {
  if (!iso) return 'Sin registro'
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function periodoTexto(periodo) {
  if (!/^\d{4}-[AB]$/.test(periodo ?? '')) return periodo ?? ''
  return `${periodo.endsWith('A') ? 'Ene–Jun' : 'Ago–Dic'} ${periodo.slice(0, 4)}`
}

export const modalidadTexto = (modalidad) => (modalidad === 'MIXTO' ? 'Mixto' : 'Escolarizado')

export const semestreTexto = (semestre) => (semestre ? `${semestre}.º semestre` : 'Sin semestre')

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/** Igual que Calificaciones: promedio simple de las unidades con número, a un decimal. */
export function promedio(values) {
  const numeros = values.filter((value) => typeof value === 'number')
  return numeros.length ? Number((numeros.reduce((suma, value) => suma + value, 0) / numeros.length).toFixed(1)) : null
}

export const formatoNota = (value) => (typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : '—')

/** Calificación de una unidad: real si la unidad cerró o el docente la capturó, provisional si sigue abierta. */
export function tipoCalificacion(row) {
  if (row?.calificacionFinal == null) return 'SIN_CAPTURA'
  if (row.unidad?.status === 'FINALIZADA' || row.calificacionManual != null) return 'REAL'
  return 'PROVISIONAL'
}

/** Ciclo Ago–Dic: semestres impares; Ene–Jun: pares. Solo es el filtro predeterminado de la retícula. */
export const esDeLaParidad = (semestre, periodo) => semestre != null && (periodo?.endsWith('B') ? semestre % 2 === 1 : semestre % 2 === 0)

const DIAS_CORTOS = { LUNES: 'lun', MARTES: 'mar', MIERCOLES: 'mié', MIÉRCOLES: 'mié', JUEVES: 'jue', VIERNES: 'vie', SABADO: 'sáb', SÁBADO: 'sáb', DOMINGO: 'dom' }
const ORDEN_DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
/** «LUNES,MARTES,…,VIERNES» → «Lun a vie»; días sueltos → «Lun, mié». */
export function diasTexto(dias) {
  const cortos = [...new Set(String(dias).split(',').map((d) => DIAS_CORTOS[d.trim().toUpperCase()] ?? d.trim().toLowerCase()).filter(Boolean))]
    .sort((a, b) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b))
  const indices = cortos.map((d) => ORDEN_DIAS.indexOf(d))
  const seguidos = cortos.length > 2 && indices.every((n, i) => i === 0 || n === indices[i - 1] + 1)
  const texto = seguidos ? `${cortos[0]} a ${cortos.at(-1)}` : cortos.join(', ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
