import { esEnClase, parseRubrica, TASK_TYPE_LABEL, tipoActividad } from './tareas'
import { sanitizarNombreArchivo } from './nombreArchivo'
import { anchosDocx, BORDES_DOCX, cargarLogos, encabezadoDocx, encabezadoPdf, MARGEN_PDF, PAGINA_CARTA_DOCX, piePdf, pieDocx } from './formatoInstitucional'

/**
 * Documento con las instrucciones completas de una tarea, para mandarlo al
 * grupo de WhatsApp mientras los alumnos no usan la app. PDF o Word.
 */

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function fechaLarga(value) {
  const d = new Date(value)
  const fecha = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)}, ${hora} h`
}

/** Lo que va en el documento, ya en texto: lo comparten el PDF y el Word. */
export function contenidoTarea(tarea, { docente } = {}) {
  const materia = tarea.materia ? `${tarea.materia.nombre}${tarea.materia.clave ? ` (${tarea.materia.clave})` : ''}` : ''
  const unidad = tarea.unidadRef
    ? `Unidad ${tarea.unidadRef.orden}${tarea.unidadRef.nombre ? `: ${tarea.unidadRef.nombre}` : ''}`
    : tarea.unidad ? `Unidad ${tarea.unidad}` : ''
  const datos = [
    ['Materia', materia],
    ['Grupo', tarea.grupo?.nombre ?? ''],
    ['Docente', docente ?? ''],
    ['Unidad', unidad],
    ['Publicada', tarea.fechaPublicacion ? fechaLarga(tarea.fechaPublicacion) : ''],
    ['Tipo', tipoActividad(tarea).singular],
    esEnClase(tarea)
      ? ['Fecha de aplicación', tarea.tieneFechaLimite && tarea.fechaLimite ? fechaLarga(tarea.fechaLimite) : 'Por confirmar']
      : ['Fecha límite', tarea.tieneFechaLimite && tarea.fechaLimite ? fechaLarga(tarea.fechaLimite) : 'Sin fecha límite'],
    ['Entrega', esEnClase(tarea) ? 'En clase: no se sube nada' : [TASK_TYPE_LABEL[tarea.tipoEntrega], tarea.permiteReenvio ? 'se puede reenviar' : ''].filter(Boolean).join(' · ')],
  ].filter(([, valor]) => valor)
  return {
    titulo: tarea.titulo,
    tipo: tipoActividad(tarea).singular,
    materia: tarea.materia?.nombre ?? '',
    datos,
    instrucciones: String(tarea.instrucciones ?? '').replace(/\r\n/g, '\n').trim(),
    rubrica: parseRubrica(tarea.rubricJson),
    adjuntos: (tarea.archivos ?? []).map((archivo) => archivo.nombre).filter(Boolean),
  }
}

export function nombreDocumentoTarea(tarea, formato) {
  // "Examen - Parcial 1 - 806A.pdf": el tipo va primero (sin criterio, "Tarea").
  const tipo = tipoActividad(tarea).singular
  const partes = [tipo, tarea.titulo, tarea.grupo?.nombre].filter(Boolean).join(' - ')
  return `${sanitizarNombreArchivo(partes, tipo)}.${formato}`
}

// Las fuentes estándar de jsPDF solo traen WinAnsi: acentos, ñ, comillas y
// guiones sí; emojis y otros símbolos saldrían como basura.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
function paraPdf(texto) {
  return Array.from(String(texto)).filter((c) => c.charCodeAt(0) <= 0xff || WINANSI_EXTRA.includes(c)).join('')
}

/** "Instrucciones de examen" en el renglón del nombre del documento. */
function nombreFormato(c) {
  return { titulo: `Instrucciones de ${c.tipo.toLowerCase()}`, subtitulo: c.materia || undefined }
}

async function generarPdf(c) {
  const [{ jsPDF }, logos] = await Promise.all([import('jspdf'), cargarLogos()])
  const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = MARGEN_PDF
  const util = ancho - margen * 2
  const abajo = alto - 18
  const pt = 25.4 / 72
  let y = encabezadoPdf(doc, nombreFormato(c), logos)

  const espacio = (h) => {
    if (y + h <= abajo) return
    doc.addPage()
    y = margen
  }
  const parrafo = (texto, { size = 10.5, bold = false, x = margen, w = util, interlineado = 1.4, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(0, 0, 0)
    const linea = size * pt * interlineado
    for (const fila of doc.splitTextToSize(paraPdf(texto), w)) {
      espacio(linea)
      doc.text(fila, align === 'center' ? x + w / 2 : x, y + linea * 0.75, { align })
      y += linea
    }
  }
  const seccion = (titulo) => {
    y += 4
    espacio(16)
    parrafo(titulo.toUpperCase(), { size: 11, bold: true, align: 'center' })
    y += 2
  }
  // Tabla con borde negro como las del acta; `anchos` en proporciones.
  const tabla = ({ columnas, anchos, filas, alinear = [] }) => {
    const total = anchos.reduce((a, b) => a + b, 0)
    const ws = anchos.map((a) => (a / total) * util)
    const relleno = 5 * pt
    const fila = (celdas, cabecera) => {
      doc.setFontSize(9.5)
      const lineas = celdas.map((celda, i) => {
        doc.setFont('helvetica', cabecera || celda.negrita ? 'bold' : 'normal')
        return doc.splitTextToSize(paraPdf(celda.texto ?? celda), ws[i] - relleno * 2)
      })
      const altoLinea = 9.5 * pt * 1.25
      const h = Math.max(cabecera ? 23 * pt : 20 * pt, ...lineas.map((l) => l.length * altoLinea + relleno * 2))
      if (y + h > abajo) {
        doc.addPage()
        y = margen
        if (!cabecera && columnas) fila(columnas, true)
      }
      let x = margen
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.75 * pt)
      celdas.forEach((celda, i) => {
        doc.rect(x, y, ws[i], h)
        doc.setFont('helvetica', cabecera || celda.negrita ? 'bold' : 'normal')
        doc.setTextColor(0, 0, 0)
        const alinea = cabecera ? 'center' : (alinear[i] ?? 'left')
        const tx = alinea === 'center' ? x + ws[i] / 2 : alinea === 'right' ? x + ws[i] - relleno : x + relleno
        const inicio = y + (h - lineas[i].length * altoLinea) / 2 + altoLinea * 0.75
        lineas[i].forEach((texto, j) => doc.text(texto, tx, inicio + j * altoLinea, { align: alinea }))
        x += ws[i]
      })
      y += h
    }
    if (columnas) fila(columnas, true)
    filas.forEach((celdas) => fila(celdas, false))
    y += 4
  }

  parrafo(c.titulo, { size: 13, bold: true, interlineado: 1.25 })
  y += 3
  tabla({ anchos: [28, 72], filas: c.datos.map(([etiqueta, valor]) => [{ texto: etiqueta, negrita: true }, valor]) })

  seccion('Instrucciones')
  for (const bloque of (c.instrucciones || 'Sin instrucciones.').split('\n')) {
    if (bloque.trim()) parrafo(bloque)
    else y += 2.5
  }

  if (c.rubrica) {
    seccion('Rúbrica de evaluación')
    tabla({
      columnas: ['Criterio', 'Peso'],
      anchos: [82, 18],
      alinear: ['left', 'center'],
      filas: c.rubrica.map((fila) => [fila.criterio, `${fila.peso}%`]),
    })
  }

  if (c.adjuntos.length) {
    seccion('Archivos de apoyo (se comparten aparte)')
    for (const nombre of c.adjuntos) parrafo(`• ${nombre}`)
  }

  piePdf(doc)
  return doc.output('blob')
}

async function generarDocx(c) {
  const [docx, logos] = await Promise.all([import('docx'), cargarLogos()])
  const { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } = docx
  const seccion = (texto) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text: texto.toUpperCase(), bold: true, size: 22 })],
  })
  const celda = (texto, { bold = false, ancho, alinear } = {}) => new TableCell({
    width: { size: anchosDocx([ancho, 100 - ancho])[0], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ alignment: alinear, children: [new TextRun({ text: texto, bold })] })],
  })

  const hijos = [
    ...encabezadoDocx(docx, nombreFormato(c), logos),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: c.titulo, bold: true, size: 26 })] }),
    new Table({
      width: { size: anchosDocx([1])[0], type: WidthType.DXA },
      columnWidths: anchosDocx([28, 72]),
      borders: BORDES_DOCX,
      rows: c.datos.map(([etiqueta, valor]) => new TableRow({ children: [celda(etiqueta, { bold: true, ancho: 28 }), celda(valor, { ancho: 72 })] })),
    }),
    seccion('Instrucciones'),
    ...(c.instrucciones || 'Sin instrucciones.').split('\n').map((linea) => new Paragraph({ text: linea, spacing: { after: 80 } })),
  ]

  if (c.rubrica) {
    hijos.push(seccion('Rúbrica de evaluación'), new Table({
      width: { size: anchosDocx([1])[0], type: WidthType.DXA },
      columnWidths: anchosDocx([82, 18]),
      borders: BORDES_DOCX,
      rows: [
        new TableRow({ tableHeader: true, children: [celda('Criterio', { bold: true, ancho: 82, alinear: AlignmentType.CENTER }), celda('Peso', { bold: true, ancho: 18, alinear: AlignmentType.CENTER })] }),
        ...c.rubrica.map((fila) => new TableRow({ children: [celda(fila.criterio, { ancho: 82 }), celda(`${fila.peso}%`, { ancho: 18, alinear: AlignmentType.CENTER })] })),
      ],
    }))
  }

  if (c.adjuntos.length) {
    hijos.push(seccion('Archivos de apoyo (se comparten aparte)'), ...c.adjuntos.map((nombre) => new Paragraph({ text: nombre, bullet: { level: 0 } })))
  }

  const documento = new Document({
    creator: 'SICAT',
    title: c.titulo,
    styles: { default: { document: { run: { font: 'Arial', size: 21 } } } },
    sections: [{ properties: { page: PAGINA_CARTA_DOCX }, footers: { default: pieDocx(docx) }, children: hijos }],
  })
  return Packer.toBlob(documento)
}

/** Devuelve un `File` listo para compartir o descargar. */
export async function generarDocumentoTarea(tarea, formato = 'pdf', opciones = {}) {
  const contenido = contenidoTarea(tarea, opciones)
  const blob = formato === 'docx' ? await generarDocx(contenido) : await generarPdf(contenido)
  return new File([blob], nombreDocumentoTarea(tarea, formato), { type: MIME[formato] ?? MIME.pdf })
}
