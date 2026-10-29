import { sanitizarNombreArchivo } from './nombreArchivo'
import { anchosDocx, BORDES_DOCX, cargarLogos, encabezadoDocx, encabezadoPdf, MARGEN_PDF, PAGINA_CARTA_DOCX, piePdf, pieDocx } from './formatoInstitucional'

/**
 * Acta de reunión de academia (formato F01PSA01.02). Un solo modelo arma el
 * texto del acta y de él salen las tres versiones: la vista en la app
 * (ActaDocumento), el PDF y el Word.
 */

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
const INSTITUTO = 'Instituto Tecnológico Superior de Cosamaloapan'
const GUION = '-'
const RAYA = '—'

const aFecha = (clave) => { const [y, m, d] = clave.split('-').map(Number); return new Date(y, m - 1, d) }
/** "dd/mm/aaaa", como en el acta impresa. */
const fechaCorta = (clave) => (clave ? aFecha(clave).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : RAYA)
const fechaLarga = (clave) => aFecha(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

export const academiaDe = (reunion) => reunion.academia?.trim() || `Academia de ${reunion.carrera?.nombre ?? 'la carrera'}`

/** Párrafo de apertura propuesto a partir de la convocatoria; la jefatura lo edita. */
export function generarApertura(r) {
  const donde = r.modalidad === 'VIRTUAL'
    ? 'Reunidos en sesión en línea'
    : `Reunidos en ${r.lugar?.trim() ? `${r.lugar.trim()} del ${INSTITUTO}` : `el ${INSTITUTO}`}`
  const hora = r.horaInicio ? `, siendo las ${r.horaInicio} horas` : ''
  const fecha = r.fecha ? ` del día ${fechaLarga(r.fecha)}` : ''
  const tipo = r.tipo === 'EXTRAORDINARIA' ? 'extraordinaria' : 'ordinaria'
  return `${donde}${hora}${fecha}, los integrantes de la ${academiaDe(r)} celebran la reunión ${tipo} de academia${r.asunto?.trim() ? ` para tratar: ${r.asunto.trim().replace(/[.;:,\s]+$/, '')}` : ''}, bajo el siguiente:`
}

/**
 * Todo lo que va en el acta, ya en texto. Antes de finalizar es la
 * convocatoria: acuerdos vacíos y la constancia con todos los convocados.
 */
export function modeloActa(r) {
  const tipo = r.tipo === 'EXTRAORDINARIA' ? 'Extraordinaria' : 'Ordinaria'
  const asistentes = r.asistencia?.registrada ? r.convocados.filter((d) => d.asistio === true) : r.convocados
  const cierre = r.horaCierre || r.horaFin
  return {
    formato: { titulo: 'Acta de reunión de la academia de', subtitulo: academiaDe(r) },
    encabezado: `Acta ${tipo} No. ${r.numeroActa?.trim() || '_____'}`,
    apertura: r.apertura?.trim() || generarApertura(r),
    puntos: r.puntos.length ? r.puntos.map((p) => [String(p.orden), p.descripcion]) : [['1', GUION]],
    transicion: 'Aprobado el Orden del Día, se procede a la revisión de acuerdos de la minuta anterior bajo el siguiente:',
    seguimiento: r.seguimiento?.length
      ? r.seguimiento.map((a) => [a.descripcion, a.responsable || GUION, fechaCorta(a.fechaLimite), a.avance || GUION])
      : [[GUION, GUION, RAYA, GUION]],
    acuerdos: r.acuerdos.length
      ? r.acuerdos.map((a) => [a.descripcion, a.responsable || GUION, fechaCorta(a.fechaLimite)])
      : [[GUION, GUION, RAYA]],
    cierre: `Sin otro asunto que tratar, el Presidente da por terminada la reunión, siendo las ${cierre ?? '_____'} horas del mismo día.`,
    presidente: r.presidente?.nombre ?? '',
    secretario: r.secretario?.nombre ?? '',
    constancia: asistentes.length
      ? asistentes.map((d) => [d.nombre, (d.materias ?? []).join(', ')])
      : [[GUION, '']],
    observaciones: r.observaciones?.trim() || 'Sin observaciones.',
  }
}

export function nombreActa(reunion, formato) {
  const nombre = sanitizarNombreArchivo(`Acta ${reunion.titulo} ${reunion.fecha}`, 'Acta de reunion')
  return `${nombre}.${formato}`
}

// Las fuentes estándar de jsPDF solo traen WinAnsi (igual que documentoTarea).
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const paraPdf = (texto) => Array.from(String(texto)).filter((c) => c.charCodeAt(0) <= 0xff || WINANSI_EXTRA.includes(c)).join('')

async function generarPdf(m) {
  const [{ jsPDF }, logos] = await Promise.all([import('jspdf'), cargarLogos()])
  const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true })
  const pt = 25.4 / 72
  const margen = MARGEN_PDF
  const util = doc.internal.pageSize.getWidth() - margen * 2
  const abajo = doc.internal.pageSize.getHeight() - 18
  let y = encabezadoPdf(doc, m.formato, logos)

  const espacio = (h) => {
    if (y + h <= abajo) return
    doc.addPage()
    y = margen
  }
  const parrafo = (texto, { size = 10, bold = false, align = 'left', interlineado = 1.35 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(0, 0, 0)
    const linea = size * pt * interlineado
    for (const fila of doc.splitTextToSize(paraPdf(texto), util)) {
      espacio(linea)
      doc.text(fila, align === 'center' ? margen + util / 2 : margen, y + linea * 0.75, { align })
      y += linea
    }
  }
  const seccion = (titulo) => {
    y += 3
    espacio(14)
    parrafo(titulo, { bold: true, align: 'center' })
    y += 2
  }
  // Celda: texto o { texto, negrita, alinear, alto (mínimo, mm), abajo }.
  const tabla = ({ columnas, anchos, filas }) => {
    const total = anchos.reduce((a, b) => a + b, 0)
    const ws = anchos.map((a) => (a / total) * util)
    const relleno = 5 * pt
    const altoLinea = 9 * pt * 1.25
    const fila = (celdas, cabecera) => {
      doc.setFontSize(9)
      const datos = celdas.map((c) => (typeof c === 'object' && c ? c : { texto: c }))
      const lineas = datos.map((c, i) => {
        doc.setFont('helvetica', cabecera || c.negrita ? 'bold' : 'normal')
        return c.texto ? doc.splitTextToSize(paraPdf(c.texto), ws[i] - relleno * 2) : []
      })
      const h = Math.max(cabecera ? 24 * pt : 26 * pt, ...datos.map((c) => c.alto ?? 0), ...lineas.map((l) => l.length * altoLinea + relleno * 2))
      if (y + h > abajo) {
        doc.addPage()
        y = margen
        if (!cabecera && columnas) fila(columnas, true)
      }
      let x = margen
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.75 * pt)
      datos.forEach((c, i) => {
        doc.rect(x, y, ws[i], h)
        doc.setFont('helvetica', cabecera || c.negrita ? 'bold' : 'normal')
        doc.setTextColor(0, 0, 0)
        const alinea = cabecera ? 'center' : (c.alinear ?? 'left')
        const tx = alinea === 'center' ? x + ws[i] / 2 : x + relleno
        const inicio = c.abajo
          ? y + h - relleno - (lineas[i].length - 1) * altoLinea - altoLinea * 0.25
          : y + (h - lineas[i].length * altoLinea) / 2 + altoLinea * 0.75
        lineas[i].forEach((texto, j) => doc.text(texto, tx, inicio + j * altoLinea, { align: alinea }))
        x += ws[i]
      })
      y += h
    }
    if (columnas) fila(columnas, true)
    filas.forEach((celdas) => fila(celdas, false))
    y += 3
  }

  parrafo(m.encabezado, { size: 11, bold: true })
  y += 2
  parrafo(m.apertura)
  seccion('ORDEN DEL DÍA')
  tabla({ columnas: ['No.', 'Descripción'], anchos: [8, 92], filas: m.puntos.map(([n, d]) => [{ texto: n, alinear: 'center' }, d]) })
  parrafo(m.transicion)
  seccion('SEGUIMIENTO DE ACUERDOS ANTERIORES')
  tabla({ columnas: ['Acuerdo', 'Responsable', 'Fecha de cumplimiento', 'Avance'], anchos: [36, 19, 17, 28], filas: m.seguimiento })
  seccion('ACUERDOS DE REUNIÓN')
  tabla({ columnas: ['Acuerdo', 'Responsable', 'Fecha de cumplimiento'], anchos: [49, 26, 25], filas: m.acuerdos })
  parrafo(m.cierre)
  y += 8
  espacio(60 * pt * 2)
  tabla({
    columnas: ['PRESIDENTE(A)', 'SECRETARIO(A)'],
    anchos: [50, 50],
    filas: [
      [{ texto: m.presidente, alinear: 'center' }, { texto: m.secretario, alinear: 'center' }],
      [{ texto: 'FIRMA', alinear: 'center', alto: 52 * pt, abajo: true }, { texto: 'FIRMA', alinear: 'center', alto: 52 * pt, abajo: true }],
    ],
  })
  seccion('CONSTANCIA DE APROBACIÓN')
  parrafo('Nombre y firma de los miembros de la academia que asistieron a la reunión y manifiestan su aprobación para la presente acta.')
  y += 2
  tabla({ columnas: ['Profesor', 'Materia que imparte', 'Firma'], anchos: [38, 36, 26], filas: m.constancia.map(([nombre, materias]) => [nombre, materias, { texto: '', alto: 36 * pt }]) })
  seccion('OBSERVACIONES')
  parrafo(m.observaciones)

  piePdf(doc)
  return doc.output('blob')
}

async function generarDocx(m) {
  const [docx, logos] = await Promise.all([import('docx'), cargarLogos()])
  const { AlignmentType, Document, HeightRule, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } = docx
  const texto = (t, opciones = {}) => new TextRun({ text: t, size: 20, font: 'Arial', ...opciones })
  const parrafo = (t, opciones = {}) => new Paragraph({ spacing: { after: 160 }, children: [texto(t, opciones)] })
  const seccion = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 120 }, children: [texto(t, { bold: true })] })
  const tabla = ({ columnas, anchos, filas }) => {
    const ws = anchosDocx(anchos)
    const celda = (c, i, cabecera) => {
      const dato = typeof c === 'object' && c ? c : { texto: c }
      const centrado = cabecera || dato.alinear === 'center'
      return new TableCell({
        width: { size: ws[i], type: WidthType.DXA },
        verticalAlign: dato.abajo ? VerticalAlign.BOTTOM : VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({ alignment: centrado ? AlignmentType.CENTER : AlignmentType.LEFT, children: [texto(dato.texto ?? '', { bold: cabecera || dato.negrita, size: 18 })] })],
      })
    }
    const fila = (celdas, cabecera) => {
      const alto = celdas.reduce((max, c) => Math.max(max, (typeof c === 'object' && c?.alto) || 0), 0)
      return new TableRow({
        tableHeader: cabecera,
        height: alto ? { value: alto, rule: HeightRule.ATLEAST } : undefined,
        children: celdas.map((c, i) => celda(c, i, cabecera)),
      })
    }
    // Ancho fijo: sin él algunos lectores encogen la tabla al contenido.
    return new Table({
      width: { size: anchosDocx([1])[0], type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: ws,
      borders: BORDES_DOCX,
      rows: [...(columnas ? [fila(columnas, true)] : []), ...filas.map((f) => fila(f, false))],
    })
  }
  const espacio = () => new Paragraph({ text: '', spacing: { after: 80 } })

  // Alturas en twips (1 pt = 20).
  const hijos = [
    ...encabezadoDocx(docx, m.formato, logos),
    parrafo(m.encabezado, { bold: true, size: 22 }),
    parrafo(m.apertura),
    seccion('ORDEN DEL DÍA'),
    tabla({ columnas: ['No.', 'Descripción'], anchos: [8, 92], filas: m.puntos.map(([n, d]) => [{ texto: n, alinear: 'center' }, d]) }),
    espacio(),
    parrafo(m.transicion),
    seccion('SEGUIMIENTO DE ACUERDOS ANTERIORES'),
    tabla({ columnas: ['Acuerdo', 'Responsable', 'Fecha de cumplimiento', 'Avance'], anchos: [36, 19, 17, 28], filas: m.seguimiento }),
    seccion('ACUERDOS DE REUNIÓN'),
    tabla({ columnas: ['Acuerdo', 'Responsable', 'Fecha de cumplimiento'], anchos: [49, 26, 25], filas: m.acuerdos }),
    espacio(),
    parrafo(m.cierre),
    new Paragraph({ text: '', spacing: { after: 480 } }),
    tabla({
      columnas: ['PRESIDENTE(A)', 'SECRETARIO(A)'],
      anchos: [50, 50],
      filas: [
        [{ texto: m.presidente, alinear: 'center' }, { texto: m.secretario, alinear: 'center' }],
        [{ texto: 'FIRMA', alinear: 'center', alto: 1040, abajo: true }, { texto: 'FIRMA', alinear: 'center', alto: 1040, abajo: true }],
      ],
    }),
    seccion('CONSTANCIA DE APROBACIÓN'),
    parrafo('Nombre y firma de los miembros de la academia que asistieron a la reunión y manifiestan su aprobación para la presente acta.'),
    tabla({ columnas: ['Profesor', 'Materia que imparte', 'Firma'], anchos: [38, 36, 26], filas: m.constancia.map(([nombre, materias]) => [nombre, materias, { texto: '', alto: 720 }]) }),
    seccion('OBSERVACIONES'),
    parrafo(m.observaciones),
  ]

  const documento = new Document({
    creator: 'SICAT',
    title: m.encabezado,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ properties: { page: PAGINA_CARTA_DOCX }, footers: { default: pieDocx(docx) }, children: hijos }],
  })
  return Packer.toBlob(documento)
}

/** El acta generada por el sistema, como `File` listo para descargar. */
export async function generarActa(reunion, formato = 'pdf') {
  const modelo = modeloActa(reunion)
  const blob = formato === 'docx' ? await generarDocx(modelo) : await generarPdf(modelo)
  return new File([blob], nombreActa(reunion, formato), { type: MIME[formato] ?? MIME.pdf })
}
