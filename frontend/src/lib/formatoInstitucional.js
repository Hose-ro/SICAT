import itscoUrl from '@/logoTec/itsco-logo.png'
import sevUrl from '@/logoTec/sev-logo.png'

/**
 * Formato institucional de los documentos que se generan en el navegador
 * (instrucciones de tarea, horario). Es el mismo del backend
 * (backend/src/reportes/formato-institucional.ts), copiado del acta de
 * academia: recuadro con los logotipos, nombre del instituto, nombre del
 * documento, referencia a la norma y "PÁGINA n DE m" al pie.
 */

export const INSTITUCION = 'INSTITUTO TECNOLÓGICO SUPERIOR DE COSAMALOAPAN'
const NORMA = 'Referencia a la Norma ISO 9001/2008:'
const APARTADO = '8.2 Seguimiento y Medición.'
const SEV_PROPORCION = 600 / 284
const PT = 25.4 / 72

let logos = null

/** Bytes de los logotipos; si no se pueden leer el documento sale sin ellos. */
export async function cargarLogos() {
  if (logos) return logos
  try {
    const leer = async (url) => {
      const respuesta = await fetch(url)
      if (!respuesta.ok) throw new Error(`logo ${respuesta.status}`)
      return new Uint8Array(await respuesta.arrayBuffer())
    }
    const [itsco, sev] = await Promise.all([leer(itscoUrl), leer(sevUrl)])
    logos = { itsco, sev }
  } catch {
    return null
  }
  return logos
}

// ── jsPDF (unidades en mm) ─────────────────────────────────────────────────

/** Márgenes del acta: 40 pt a los lados, el recuadro a 28 pt del borde. */
export const MARGEN_PDF = 40 * PT
const ARRIBA = 28 * PT

/**
 * Dibuja el recuadro del encabezado en la página actual y devuelve la `y`
 * (mm) donde empieza el contenido.
 */
export function encabezadoPdf(doc, formato, logosCargados) {
  const ancho = doc.internal.pageSize.getWidth()
  const x = MARGEN_PDF
  const util = ancho - MARGEN_PDF * 2
  const anchoLogos = Math.min(util * 0.29, 190 * PT)
  const xDerecha = x + anchoLogos
  const anchoTexto = util - anchoLogos - 16 * PT

  doc.setFont('helvetica', 'bold')
  let tamanoInstitucion = 13
  doc.setFontSize(tamanoInstitucion)
  while (tamanoInstitucion > 10 && doc.getTextWidth(INSTITUCION) > anchoTexto * 0.98) {
    tamanoInstitucion -= 0.5
    doc.setFontSize(tamanoInstitucion)
  }
  const lineas = [
    { texto: INSTITUCION, tamano: tamanoInstitucion },
    { texto: formato.titulo, tamano: 11 },
    ...(formato.subtitulo ? [{ texto: formato.subtitulo, tamano: 11 }] : []),
  ].map((linea, i) => {
    doc.setFontSize(linea.tamano)
    // El nombre del instituto ya se ajustó para caber en un renglón.
    const filas = i === 0 ? [linea.texto] : doc.splitTextToSize(linea.texto, anchoTexto)
    return { ...linea, filas, alto: filas.length * linea.tamano * PT * 1.15 }
  })
  const separacion = 7 * PT
  const altoTextos = lineas.reduce((suma, l) => suma + l.alto, 0) + separacion * (lineas.length - 1)
  const altoSuperior = Math.max(79 * PT, altoTextos + 22 * PT)
  const altoReferencia = 31 * PT
  const alto = altoSuperior + altoReferencia

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.75 * PT)
  doc.rect(x, ARRIBA, util, alto)
  doc.line(xDerecha, ARRIBA, xDerecha, ARRIBA + alto)
  doc.line(xDerecha, ARRIBA + altoSuperior, x + util, ARRIBA + altoSuperior)

  if (logosCargados) {
    const lado = Math.min(alto - 30 * PT, 72 * PT)
    const anchoSev = Math.min(anchoLogos - lado - 22 * PT, lado * 1.35)
    const altoSev = anchoSev / SEV_PROPORCION
    const xLogos = x + (anchoLogos - (lado + 6 * PT + anchoSev)) / 2
    doc.addImage(logosCargados.itsco, 'PNG', xLogos, ARRIBA + (alto - lado) / 2, lado, lado, 'itsco', 'FAST')
    doc.addImage(logosCargados.sev, 'PNG', xLogos + lado + 6 * PT, ARRIBA + (alto - altoSev) / 2, anchoSev, altoSev, 'sev', 'FAST')
  }

  doc.setTextColor(0, 0, 0)
  let y = ARRIBA + (altoSuperior - altoTextos) / 2
  const centro = xDerecha + (util - anchoLogos) / 2
  for (const linea of lineas) {
    doc.setFontSize(linea.tamano)
    linea.filas.forEach((fila, i) => {
      doc.text(fila, centro, y + linea.tamano * PT * (0.85 + i * 1.15), { align: 'center' })
    })
    y += linea.alto + separacion
  }

  const yReferencia = ARRIBA + altoSuperior + altoReferencia / 2 + 3.5 * PT
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`${NORMA} `, xDerecha + 10 * PT, yReferencia)
  const desplazamiento = doc.getTextWidth(`${NORMA} `)
  doc.setFont('helvetica', 'normal')
  doc.text(APARTADO, xDerecha + 10 * PT + desplazamiento, yReferencia)

  return ARRIBA + alto + 18 * PT
}

/** "PÁGINA n DE m" abajo a la derecha de cada página. */
export function piePdf(doc) {
  const total = doc.getNumberOfPages()
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(85, 85, 85)
    doc.text(`PÁGINA ${i} DE ${total}`, ancho - MARGEN_PDF, alto - 26 * PT, { align: 'right' })
  }
}

// ── Word (docx) ────────────────────────────────────────────────────────────

const BORDE = { style: 'single', size: 6, color: '000000' }
export const BORDES_DOCX = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE, insideHorizontal: BORDE, insideVertical: BORDE }

/**
 * Tabla del encabezado para la primera página del Word y el pie con el
 * número de página. `docx` es el módulo ya importado.
 */
export function encabezadoDocx(docx, formato, logosCargados) {
  const { AlignmentType, ImageRun, Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } = docx
  const negritas = (texto, size) => new TextRun({ text: texto, bold: true, size, font: 'Arial' })
  const logosCelda = logosCargados
    ? [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({ type: 'png', data: logosCargados.itsco, transformation: { width: 82, height: 82 } }),
          new TextRun({ text: '  ' }),
          new ImageRun({ type: 'png', data: logosCargados.sev, transformation: { width: 86, height: Math.round(86 / SEV_PROPORCION) } }),
        ],
      })]
    : [new Paragraph('')]

  const tabla = new Table({
    width: { size: anchosDocx([1])[0], type: WidthType.DXA },
    columnWidths: anchosDocx([29, 71]),
    borders: BORDES_DOCX,
    rows: [
      new TableRow({
        children: [
          new TableCell({ rowSpan: 2, width: { size: anchosDocx([29, 71])[0], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: logosCelda }),
          new TableCell({
            width: { size: anchosDocx([29, 71])[1], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [negritas(INSTITUCION, 24)] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [negritas(formato.titulo, 22)] }),
              ...(formato.subtitulo ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [negritas(formato.subtitulo, 22)] })] : []),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 160 },
            children: [new Paragraph({ children: [negritas(`${NORMA} `, 20), new TextRun({ text: APARTADO, size: 20, font: 'Arial' })] })],
          }),
        ],
      }),
    ],
  })
  return [tabla, new Paragraph({ text: '', spacing: { after: 200 } })]
}

export function pieDocx(docx) {
  const { AlignmentType, Footer, PageNumber, Paragraph, TextRun } = docx
  const gris = { size: 16, color: '555555', font: 'Arial' }
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ ...gris, children: ['PÁGINA ', PageNumber.CURRENT, ' DE ', PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  })
}

/** Carta en twips, para que el Word salga del mismo tamaño que el acta. */
export const PAGINA_CARTA_DOCX = {
  size: { width: 12240, height: 15840 },
  margin: { top: 560, bottom: 1000, left: 800, right: 800 },
}

/** Proporciones → anchos de columna en twips dentro del ancho útil. */
export function anchosDocx(proporciones) {
  const util = PAGINA_CARTA_DOCX.size.width - PAGINA_CARTA_DOCX.margin.left - PAGINA_CARTA_DOCX.margin.right
  const total = proporciones.reduce((a, b) => a + b, 0)
  return proporciones.map((p) => Math.round((p / total) * util))
}
