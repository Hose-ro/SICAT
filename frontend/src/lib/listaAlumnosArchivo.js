/**
 * Lectura del archivo (Excel/CSV) con el que el docente carga la lista de un
 * grupo. Vive aparte porque la misma lista se importa desde el padrón de una
 * materia y desde "Mis grupos".
 */

export const FILA_ALUMNO_VACIA = { nombre: '', numeroControl: '', email: '', telefono: '' }

const CLAVES_ENCABEZADO = {
  nombre: ['nombre', 'alumno', 'estudiante'],
  numeroControl: ['control', 'matricula', 'nocontrol'],
  email: ['correo', 'email'],
  telefono: ['telefono', 'celular', 'tel'],
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]/g, '')
}

function detectarColumna(encabezados, claves) {
  return encabezados.findIndex((encabezado) => claves.some((clave) => encabezado.includes(clave)))
}

/** A partir de filas crudas (arreglo de arreglos) intenta ubicar las columnas
 * de nombre/control/correo/teléfono por el texto del encabezado. Si ninguna
 * columna se reconoce como "nombre", asume que el archivo no trae encabezado
 * y que cada fila es un alumno con el nombre en la primera columna. */
export function filasDesdeHoja(filasCrudas) {
  const filas = filasCrudas
    .map((fila) =>
      (Array.isArray(fila) ? fila : []).map((celda) => (celda == null ? '' : String(celda).trim())),
    )
    .filter((fila) => fila.some((celda) => celda !== ''))

  if (filas.length === 0) return []

  const encabezados = filas[0].map(normalizarTexto)
  const colNombre = detectarColumna(encabezados, CLAVES_ENCABEZADO.nombre)

  if (colNombre === -1) {
    return filas.map((fila) => ({ ...FILA_ALUMNO_VACIA, nombre: fila[0] || '' }))
  }

  const colControl = detectarColumna(encabezados, CLAVES_ENCABEZADO.numeroControl)
  const colEmail = detectarColumna(encabezados, CLAVES_ENCABEZADO.email)
  const colTelefono = detectarColumna(encabezados, CLAVES_ENCABEZADO.telefono)

  return filas.slice(1).map((fila) => ({
    nombre: fila[colNombre] || '',
    numeroControl: colControl >= 0 ? fila[colControl] || '' : '',
    email: colEmail >= 0 ? fila[colEmail] || '' : '',
    telefono: colTelefono >= 0 ? fila[colTelefono] || '' : '',
  }))
}

export async function leerListaDeArchivo(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', blankrows: false })
  return filasDesdeHoja(filasCrudas)
}
