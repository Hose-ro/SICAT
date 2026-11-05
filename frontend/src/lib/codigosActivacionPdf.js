import { cargarLogos, encabezadoPdf, MARGEN_PDF, piePdf } from './formatoInstitucional'
import { sanitizarNombreArchivo } from './nombreArchivo'

const COLUMNAS = 2
const SEPARACION = 4
const ALTO_TARJETA = 34
/** Lo que deja libre el "PÁGINA n DE m" del pie. */
const ESPACIO_PIE = 16

/**
 * Hoja carta con una tarjeta recortable por alumno: nombre, número de control
 * y código. El encabezado institucional va sólo en la primera página, como en
 * los demás formatos.
 */
export function crearCodigosActivacionPdf(jsPDF, { grupo, alumnos, vigenciaDias }, logos) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const util = anchoPagina - MARGEN_PDF * 2
  const anchoTarjeta = (util - SEPARACION * (COLUMNAS - 1)) / COLUMNAS
  const relleno = 3.5

  let y = encabezadoPdf(doc, { titulo: 'Códigos de activación', subtitulo: `Grupo ${grupo.nombre}` }, logos)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text('Recorta cada tarjeta y entrégala en mano al alumno. Cada código abre sólo la cuenta de su alumno.', MARGEN_PDF, y)
  y += 5

  alumnos.forEach((alumno, i) => {
    const columna = i % COLUMNAS
    if (columna === 0 && i > 0) y += ALTO_TARJETA + SEPARACION
    if (columna === 0 && y + ALTO_TARJETA > altoPagina - ESPACIO_PIE) {
      doc.addPage()
      y = MARGEN_PDF
    }
    const x = MARGEN_PDF + columna * (anchoTarjeta + SEPARACION)
    const ancho = anchoTarjeta - relleno * 2

    doc.setDrawColor(130, 130, 130)
    doc.setLineWidth(0.25)
    doc.setLineDashPattern([1.5, 1.2], 0)
    doc.roundedRect(x, y, anchoTarjeta, ALTO_TARJETA, 2, 2)
    doc.setLineDashPattern([], 0)

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    const nombre = doc.splitTextToSize(alumno.nombre ?? '', ancho).slice(0, 2)
    doc.text(nombre, x + relleno, y + 5.5)
    let ty = y + 5.5 + nombre.length * 4.2

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Número de control: ${alumno.numeroControl ?? '-'}`, x + relleno, ty)
    ty += 6.5

    doc.text('Código:', x + relleno, ty)
    doc.setFont('courier', 'bold')
    doc.setFontSize(15)
    doc.text(alumno.codigo ?? '', x + relleno + 14, ty + 0.3)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(85, 85, 85)
    const ayuda = doc.splitTextToSize(
      `Entra a SICAT y elige "Activa tu cuenta con tu código". Vigente ${vigenciaDias} días, un solo uso.`,
      ancho,
    )
    doc.text(ayuda, x + relleno, y + ALTO_TARJETA - relleno - (ayuda.length - 1) * 2.8)
  })

  piePdf(doc)
  return doc
}

export async function generarCodigosActivacionPdf({ grupo, alumnos, vigenciaDias, nombreArchivo }) {
  const [{ jsPDF }, logos] = await Promise.all([import('jspdf'), cargarLogos()])
  const doc = crearCodigosActivacionPdf(jsPDF, { grupo, alumnos, vigenciaDias }, logos)
  doc.save(`${sanitizarNombreArchivo(nombreArchivo, 'codigos-activacion')}.pdf`)
}
