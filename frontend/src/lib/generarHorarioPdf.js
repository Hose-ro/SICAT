const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const DIAS_LOWER = DIAS.map((d) => d.toLowerCase())

// Tailwind default palette (blue/emerald/orange/purple/rose/teal/amber/indigo-500),
// same order as colorParaMateria in TarjetaMateria.jsx. Hardcoded as RGB rather than
// read from the DOM/CSS: this app's theme uses oklch(), which most PDF/canvas
// rasterizers (and jsPDF) don't parse — safest to keep this palette as a plain,
// independent RGB copy instead of trying to resolve it from computed styles.
const COLORES = [
  [59, 130, 246],
  [16, 185, 129],
  [249, 115, 22],
  [168, 85, 247],
  [244, 63, 94],
  [20, 184, 166],
  [245, 158, 11],
  [99, 102, 241],
]

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function sanitizarNombreArchivo(nombre) {
  return nombre.replace(/[\\/:*?"<>|]/g, '').trim() || 'horario'
}

function dibujarBloque(doc, x, y, w, h, color, horario) {
  doc.setFillColor(color[0], color[1], color[2])
  doc.roundedRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8, 0.8, 0.8, 'F')

  const padX = 1.6
  const maxWidth = w - padX * 2
  const maxLines = Math.max(1, Math.floor((h - 1.5) / 3))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  const nombreLines = doc.splitTextToSize(horario.materia.nombre, maxWidth)

  const lineas = nombreLines.map((text) => ({ text, bold: true }))
  if (horario.grupo?.nombre) lineas.push({ text: horario.grupo.nombre, bold: false })
  if (horario.aula?.nombre) lineas.push({ text: horario.aula.nombre, bold: false })

  doc.setTextColor(255, 255, 255)
  let ty = y + 3
  lineas.slice(0, maxLines).forEach((linea) => {
    doc.setFont('helvetica', linea.bold ? 'bold' : 'normal')
    doc.setFontSize(linea.bold ? 7.2 : 6.6)
    doc.text(linea.text, x + padX, ty)
    ty += 3
  })
}

export async function generarHorarioPdf({ nombreArchivo, titulo, subtitulo, horarios }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 41, 59)
  doc.text(titulo, margin, margin + 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(subtitulo, margin, margin + 10)

  // Hour range sized to the actual data (±1h padding) instead of a fixed
  // 07:00-21:00 window, so the grid always fills the page without empty rows.
  let minMin = Infinity
  let maxMin = -Infinity
  horarios.forEach((h) => {
    minMin = Math.min(minMin, aMinutos(h.horaInicio))
    maxMin = Math.max(maxMin, aMinutos(h.horaFin))
  })
  const horaInicioGrid = Math.max(0, Math.floor(minMin / 60) - 1) * 60
  const horaFinGrid = Math.min(24, Math.ceil(maxMin / 60) + 1) * 60
  const numHoras = Math.max(1, (horaFinGrid - horaInicioGrid) / 60)

  const gridLeft = margin
  const gridRight = pageWidth - margin
  const gridTop = margin + 16
  const gridBottom = pageHeight - margin
  const dayHeaderH = 7
  const rowH = (gridBottom - gridTop - dayHeaderH) / numHoras
  const hourColW = 12
  const dayColW = (gridRight - gridLeft - hourColW) / DIAS.length

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  DIAS.forEach((dia, i) => {
    const x = gridLeft + hourColW + i * dayColW
    doc.text(dia, x + dayColW / 2, gridTop + dayHeaderH - 2, { align: 'center' })
  })

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)

  for (let i = 0; i <= numHoras; i++) {
    const y = gridTop + dayHeaderH + i * rowH
    doc.line(gridLeft, y, gridRight, y)
    if (i < numHoras) {
      const hora = `${String(Math.floor((horaInicioGrid + i * 60) / 60)).padStart(2, '0')}:00`
      doc.text(hora, gridLeft + hourColW - 2, y + 3.3, { align: 'right' })
    }
  }
  for (let i = 0; i <= DIAS.length; i++) {
    const x = gridLeft + hourColW + i * dayColW
    doc.line(x, gridTop, x, gridBottom)
  }
  doc.line(gridLeft, gridTop, gridRight, gridTop)

  horarios.forEach((horario, idx) => {
    const color = COLORES[idx % COLORES.length]
    const dias = horario.dias.split(',').map((d) => d.trim().toLowerCase())
    const inicioMin = aMinutos(horario.horaInicio) - horaInicioGrid
    const finMin = aMinutos(horario.horaFin) - horaInicioGrid
    const yStart = gridTop + dayHeaderH + (inicioMin / 60) * rowH
    const blockH = ((finMin - inicioMin) / 60) * rowH

    dias.forEach((dia) => {
      const diaIdx = DIAS_LOWER.indexOf(dia)
      if (diaIdx === -1) return
      const x = gridLeft + hourColW + diaIdx * dayColW
      dibujarBloque(doc, x, yStart, dayColW, blockH, color, horario)
    })
  })

  doc.save(`${sanitizarNombreArchivo(nombreArchivo)}.pdf`)
}
