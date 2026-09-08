/**
 * Lectura del archivo (Excel/CSV) con el que el docente carga la lista de un
 * grupo. Vive aparte porque la misma lista se importa desde el padrón de una
 * materia y desde "Mis grupos".
 *
 * Cada docente arma su archivo a mano, así que no se puede dar por hecho ni el
 * orden de las columnas ni que la primera fila sea el encabezado. Las columnas
 * se ubican primero por el texto del encabezado y lo que quede sin identificar
 * —o el archivo completo, si no trae encabezado— por la forma del contenido:
 * número de control de 8 alfanuméricos, correo y teléfono de 10 dígitos.
 */

export const FILA_ALUMNO_VACIA = { nombre: '', numeroControl: '', email: '', telefono: '' }

/** Formato con el que el backend guarda el número de control: 225Q0103. */
const PATRON_CONTROL_OFICIAL = /^\d{3}[A-Za-z]\d{4}$/

/**
 * Para *ubicar* la columna basta con que el dato tenga la forma general del
 * número de control: 8 alfanuméricos con al menos un dígito (el dígito evita
 * confundirlo con un apellido de ocho letras). Así la lista se lee completa
 * aunque algún número venga mal escrito y el docente lo corrija en la vista
 * previa, en lugar de perderse en silencio.
 */
const PATRON_CONTROL = /^(?=.*\d)[A-Za-z0-9]{8}$/
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Orden de asignación: primero los campos con forma inconfundible y al final
 * el nombre, que es "lo que sobra". */
const CAMPOS = ['numeroControl', 'email', 'telefono', 'nombre']

/** Las claves de una sola sílaba van ancladas (^clave$) porque como fragmento
 * aparecerían dentro de un nombre propio ("Betel" contiene "tel"). */
const CLAVES_ENCABEZADO = {
  numeroControl: [/control/, /matricula/, /expediente/, /^nc$/, /^ctrl$/, /^clave$/],
  email: [/correo/, /email/, /^mail$/],
  telefono: [/telefono/, /celular/, /whats/, /^tel$/, /^cel$/, /^movil$/],
  nombre: [/nombre/, /apellido/, /alumno/, /estudiante/],
}

/** Filas iniciales donde se busca el encabezado (arriba puede haber título,
 * logotipo o el nombre de la escuela). */
const FILAS_ENCABEZADO = 5

/** Proporción mínima de celdas con la forma esperada para dar una columna por
 * identificada por su contenido. */
const UMBRAL_CONTENIDO = 0.6

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]/g, '')
}

function limpiarControl(valor) {
  return String(valor ?? '')
    .replace(/[\s.,\-_/]/g, '')
    .toUpperCase()
}

function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

/** Valida contra el formato que exige el backend, para avisarle al docente
 * antes de mandar la lista. */
export function esNumeroControlValido(valor) {
  return PATRON_CONTROL_OFICIAL.test(String(valor ?? '').trim())
}

function pareceNumeroControl(valor) {
  return PATRON_CONTROL.test(limpiarControl(valor))
}

function pareceEmail(valor) {
  return PATRON_EMAIL.test(String(valor ?? '').trim())
}

function pareceTelefono(valor) {
  const digitos = soloDigitos(valor)
  if (digitos.length === 10) return true
  return digitos.length > 10 && digitos.length <= 13 && digitos.startsWith('52')
}

/** Deja el teléfono en los 10 dígitos que pide el backend; lo que no llegue a
 * esa forma se descarta para no tumbar la importación completa. */
function limpiarTelefono(valor) {
  const digitos = soloDigitos(valor)
  if (digitos.length === 10) return digitos
  if (digitos.length > 10 && digitos.startsWith('52')) return digitos.slice(-10)
  return ''
}

/** Texto que puede ser un nombre: letras suficientes y ninguna de las formas
 * de los otros campos. */
function pareceTexto(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return false
  if (pareceEmail(texto) || pareceNumeroControl(texto) || pareceTelefono(texto)) return false
  return (texto.match(/\p{L}/gu) ?? []).length >= 3
}

function pareceNombreCompleto(valor) {
  return pareceTexto(valor) && String(valor).trim().split(/\s+/).length >= 2
}

function coincidenciasEncabezado(fila) {
  const textos = fila.map(normalizarTexto)
  const campos = {}
  for (const campo of CAMPOS) {
    const indices = []
    textos.forEach((texto, indice) => {
      if (texto && CLAVES_ENCABEZADO[campo].some((clave) => clave.test(texto))) indices.push(indice)
    })
    if (indices.length > 0) campos[campo] = indices
  }
  return campos
}

/** Un encabezado no trae datos: si la fila ya tiene un correo, un número de
 * control o un teléfono es la lista, no el encabezado. */
function pareceFilaDeDatos(fila) {
  return fila.some(
    (celda) => celda && (pareceEmail(celda) || pareceNumeroControl(celda) || pareceTelefono(celda)),
  )
}

function ubicarEncabezado(filas) {
  let encontrado = null
  filas.slice(0, FILAS_ENCABEZADO).forEach((fila, indice) => {
    if (pareceFilaDeDatos(fila)) return
    const campos = coincidenciasEncabezado(fila)
    const aciertos = Object.keys(campos).length
    if (aciertos === 0) return
    // Con un título arriba ("LISTA DE ALUMNOS") empatado en aciertos gana el de
    // más abajo, que es el que está pegado a los datos.
    if (!encontrado || aciertos >= encontrado.aciertos) {
      encontrado = { indice, fila, campos, aciertos }
    }
  })
  return encontrado
}

function proporcion(filas, columna, cumple) {
  let total = 0
  let aciertos = 0
  for (const fila of filas) {
    const celda = fila[columna]
    if (!celda) continue
    total += 1
    if (cumple(celda)) aciertos += 1
  }
  return total === 0 ? 0 : aciertos / total
}

function mejorColumna(filas, totalColumnas, tomadas, cumple) {
  let mejor = -1
  let mejorProporcion = 0
  for (let columna = 0; columna < totalColumnas; columna += 1) {
    if (tomadas.has(columna)) continue
    const valor = proporcion(filas, columna, cumple)
    if (valor >= UMBRAL_CONTENIDO && valor > mejorProporcion) {
      mejor = columna
      mejorProporcion = valor
    }
  }
  return mejor
}

/** De las columnas de texto se queda con la que más parece lista de nombres:
 * la que trae nombre y apellidos en la misma celda. */
function columnaDeNombre(filas, totalColumnas, tomadas) {
  const candidatas = []
  for (let columna = 0; columna < totalColumnas; columna += 1) {
    if (tomadas.has(columna)) continue
    const texto = proporcion(filas, columna, pareceTexto)
    if (texto < UMBRAL_CONTENIDO) continue
    candidatas.push({ columna, texto, completo: proporcion(filas, columna, pareceNombreCompleto) })
  }
  candidatas.sort((a, b) => b.completo - a.completo || b.texto - a.texto || a.columna - b.columna)
  return candidatas.length > 0 ? candidatas[0].columna : -1
}

/** "Apellido paterno | Apellido materno | Nombre(s)" se arma como
 * "Nombre(s) Apellido paterno Apellido materno". */
function ordenarColumnasNombre(indices, filaEncabezado) {
  const esApellido = (indice) => /apellido/.test(normalizarTexto(filaEncabezado[indice] ?? ''))
  return [...indices].sort((a, b) => Number(esApellido(a)) - Number(esApellido(b)) || a - b)
}

function ubicarColumnas(datos, encabezado) {
  const totalColumnas = datos.reduce((maximo, fila) => Math.max(maximo, fila.length), 0)
  const tomadas = new Set()
  const columnas = { nombre: [], numeroControl: -1, email: -1, telefono: -1 }

  if (encabezado) {
    for (const campo of CAMPOS) {
      const indices = (encabezado.campos[campo] ?? []).filter((indice) => !tomadas.has(indice))
      if (indices.length === 0) continue
      if (campo === 'nombre') {
        columnas.nombre = ordenarColumnasNombre(indices, encabezado.fila)
        indices.forEach((indice) => tomadas.add(indice))
      } else {
        columnas[campo] = indices[0]
        tomadas.add(indices[0])
      }
    }
  }

  // Lo que el encabezado no dijo (o no había encabezado) se busca por contenido.
  for (const campo of ['email', 'telefono', 'numeroControl']) {
    if (columnas[campo] >= 0) continue
    const cumple =
      campo === 'email' ? pareceEmail : campo === 'telefono' ? pareceTelefono : pareceNumeroControl
    const columna = mejorColumna(datos, totalColumnas, tomadas, cumple)
    if (columna >= 0) {
      columnas[campo] = columna
      tomadas.add(columna)
    }
  }

  if (columnas.nombre.length === 0) {
    let columna = columnaDeNombre(datos, totalColumnas, tomadas)
    if (columna === -1) {
      // Ninguna columna parece lista de nombres: se toma la primera libre para
      // no descartar el archivo.
      for (let i = 0; i < totalColumnas && columna === -1; i += 1) {
        if (!tomadas.has(i)) columna = i
      }
    }
    if (columna >= 0) {
      columnas.nombre = [columna]
      tomadas.add(columna)
    }
  }

  return columnas
}

/** Archivos donde el número de control viene pegado al nombre
 * ("225Q0103 Ana López"): se separa en lugar de perderse dentro del nombre. */
function separarControlDelNombre(nombre) {
  const partes = nombre.split(/\s+/)
  const indice = partes.findIndex((parte) => pareceNumeroControl(parte))
  if (indice === -1) return { nombre, numeroControl: '' }
  const numeroControl = limpiarControl(partes[indice])
  partes.splice(indice, 1)
  return {
    nombre: partes
      .join(' ')
      .replace(/^[\s\-–—:|,.]+/, '')
      .replace(/[\s\-–—:|,.]+$/, '')
      .trim(),
    numeroControl,
  }
}

/**
 * A partir de filas crudas (arreglo de arreglos) arma las filas de alumnos.
 * El orden de las columnas es indistinto y el encabezado es opcional.
 */
export function filasDesdeHoja(filasCrudas) {
  const filas = filasCrudas
    .map((fila) =>
      (Array.isArray(fila) ? fila : []).map((celda) => (celda == null ? '' : String(celda).trim())),
    )
    .filter((fila) => fila.some((celda) => celda !== ''))

  if (filas.length === 0) return []

  const encabezado = ubicarEncabezado(filas)
  const datos = encabezado ? filas.slice(encabezado.indice + 1) : filas
  if (datos.length === 0) return []

  const columnas = ubicarColumnas(datos, encabezado)

  return datos.map((fila) => {
    let nombre = columnas.nombre
      .map((columna) => fila[columna] ?? '')
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const crudoControl = columnas.numeroControl >= 0 ? (fila[columnas.numeroControl] ?? '') : ''
    // Lo que no tenga forma de número de control se deja tal cual para que el
    // docente lo vea y lo corrija en la vista previa.
    let numeroControl = pareceNumeroControl(crudoControl)
      ? limpiarControl(crudoControl)
      : String(crudoControl).trim()

    if (!numeroControl) {
      const separado = separarControlDelNombre(nombre)
      nombre = separado.nombre
      numeroControl = separado.numeroControl
    }

    const email = columnas.email >= 0 ? String(fila[columnas.email] ?? '').trim() : ''

    return {
      nombre,
      numeroControl,
      email: pareceEmail(email) ? email.toLowerCase() : '',
      telefono: columnas.telefono >= 0 ? limpiarTelefono(fila[columnas.telefono]) : '',
    }
  })
}

export async function leerListaDeArchivo(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', blankrows: false })
  return filasDesdeHoja(filasCrudas)
}
