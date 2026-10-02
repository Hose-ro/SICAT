import { parseRubrica, TASK_TYPE_LABEL } from './tareas'
import { sanitizarNombreArchivo } from './nombreArchivo'

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
    ['Fecha límite', tarea.tieneFechaLimite && tarea.fechaLimite ? fechaLarga(tarea.fechaLimite) : 'Sin fecha límite'],
    ['Entrega', [TASK_TYPE_LABEL[tarea.tipoEntrega], tarea.permiteReenvio ? 'se puede reenviar' : ''].filter(Boolean).join(' · ')],
  ].filter(([, valor]) => valor)
  return {
    titulo: tarea.titulo,
    datos,
    instrucciones: String(tarea.instrucciones ?? '').replace(/\r\n/g, '\n').trim(),
    rubrica: parseRubrica(tarea.rubricJson),
    adjuntos: (tarea.archivos ?? []).map((archivo) => archivo.nombre).filter(Boolean),
  }
}

export function nombreDocumentoTarea(tarea, formato) {
  const partes = ['Tarea', tarea.titulo, tarea.grupo?.nombre].filter(Boolean).join(' - ')
  return `${sanitizarNombreArchivo(partes, 'Tarea')}.${formato}`
}

// Las fuentes estándar de jsPDF solo traen WinAnsi: acentos, ñ, comillas y
// guiones sí; emojis y otros símbolos saldrían como basura.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
function paraPdf(texto) {
  return Array.from(String(texto)).filter((c) => c.charCodeAt(0) <= 0xff || WINANSI_EXTRA.includes(c)).join('')
}

async function generarPdf(c) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 18
  const util = ancho - margen * 2
  let y = margen

  const espacio = (h) => {
    if (y + h <= alto - margen) return
    doc.addPage()
    y = margen
  }
  const parrafo = (texto, { size = 10.5, bold = false, color = [30, 30, 30], x = margen, w = util, interlineado = 1.45 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const linea = size * 0.3528 * interlineado
    for (const fila of doc.splitTextToSize(paraPdf(texto), w)) {
      espacio(linea)
      doc.text(fila, x, y + linea * 0.75)
      y += linea
    }
  }
  const seccion = (titulo) => {
    y += 4
    espacio(12)
    parrafo(titulo.toUpperCase(), { size: 9, bold: true, color: [90, 90, 90] })
    doc.setDrawColor(210, 210, 210)
    doc.line(margen, y + 0.5, ancho - margen, y + 0.5)
    y += 3
  }

  parrafo(c.titulo, { size: 17, bold: true, interlineado: 1.25 })
  y += 3
  for (const [etiqueta, valor] of c.datos) {
    const antes = y
    parrafo(`${etiqueta}:`, { size: 10, bold: true, color: [90, 90, 90], w: 34 })
    y = antes
    parrafo(valor, { size: 10, x: margen + 34, w: util - 34 })
  }

  seccion('Instrucciones')
  for (const bloque of (c.instrucciones || 'Sin instrucciones.').split('\n')) {
    if (bloque.trim()) parrafo(bloque)
    else y += 2.5
  }

  if (c.rubrica) {
    seccion('Rúbrica de evaluación')
    for (const fila of c.rubrica) {
      const antes = y
      parrafo(fila.criterio, { w: util - 22 })
      const despues = y
      y = antes
      parrafo(`${fila.peso}%`, { bold: true, x: ancho - margen - 14, w: 14 })
      y = Math.max(despues, y) + 1
    }
  }

  if (c.adjuntos.length) {
    seccion('Archivos de apoyo (se comparten aparte)')
    for (const nombre of c.adjuntos) parrafo(`• ${nombre}`)
  }

  return doc.output('blob')
}

async function generarDocx(c) {
  const { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx')
  const seccion = (texto) => new Paragraph({ text: texto, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } })
  const sinBorde = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const celda = (texto, { bold = false, ancho, alinear } = {}) => new TableCell({
    width: { size: ancho, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ alignment: alinear, children: [new TextRun({ text: texto, bold })] })],
  })

  const hijos = [
    new Paragraph({ text: c.titulo, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
    ...c.datos.map(([etiqueta, valor]) => new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: `${etiqueta}: `, bold: true }), new TextRun(valor)],
    })),
    seccion('Instrucciones'),
    ...(c.instrucciones || 'Sin instrucciones.').split('\n').map((linea) => new Paragraph({ text: linea, spacing: { after: 80 } })),
  ]

  if (c.rubrica) {
    hijos.push(seccion('Rúbrica de evaluación'), new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [celda('Criterio', { bold: true, ancho: 82 }), celda('Peso', { bold: true, ancho: 18, alinear: AlignmentType.RIGHT })] }),
        ...c.rubrica.map((fila) => new TableRow({ children: [celda(fila.criterio, { ancho: 82 }), celda(`${fila.peso}%`, { ancho: 18, alinear: AlignmentType.RIGHT })] })),
      ],
      borders: { left: sinBorde, right: sinBorde, insideVertical: sinBorde },
    }))
  }

  if (c.adjuntos.length) {
    hijos.push(seccion('Archivos de apoyo (se comparten aparte)'), ...c.adjuntos.map((nombre) => new Paragraph({ text: nombre, bullet: { level: 0 } })))
  }

  const documento = new Document({
    creator: 'SICAT',
    title: c.titulo,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children: hijos }],
  })
  return Packer.toBlob(documento)
}

/** Devuelve un `File` listo para compartir o descargar. */
export async function generarDocumentoTarea(tarea, formato = 'pdf', opciones = {}) {
  const contenido = contenidoTarea(tarea, opciones)
  const blob = formato === 'docx' ? await generarDocx(contenido) : await generarPdf(contenido)
  return new File([blob], nombreDocumentoTarea(tarea, formato), { type: MIME[formato] ?? MIME.pdf })
}
