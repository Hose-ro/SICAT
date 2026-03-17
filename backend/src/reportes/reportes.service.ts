import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportesService {
  async generarExcelAsistencias(datosReporte: {
    materia: any;
    sesiones: any[];
    alumnos: any[];
    asistencias: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asistencias');

    const { materia, sesiones, alumnos, asistencias } = datosReporte;

    // Header info
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = `Materia: ${materia.nombre} | Docente: ${materia.docente?.nombre ?? ''}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    // Column headers
    const headerRow = sheet.addRow(['Alumno', 'Num. Control', ...sesiones.map((s) => new Date(s.fecha).toLocaleDateString('es-MX')), 'A', 'F', 'R', 'J', '%']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    // Build attendance map
    const mapaAsist = new Map<string, string>();
    for (const a of asistencias) {
      mapaAsist.set(`${a.alumnoId}_${a.claseSesionId}`, a.estado);
    }

    const estadoColores: Record<string, string> = {
      ASISTENCIA: 'FF92D050',
      FALTA: 'FFFF0000',
      RETARDO: 'FFFFFF00',
      JUSTIFICADA: 'FF4472C4',
    };

    for (const alumno of alumnos) {
      let a = 0, f = 0, r = 0, j = 0;
      const estados = sesiones.map((s) => {
        const estado = mapaAsist.get(`${alumno.id}_${s.id}`) ?? '';
        if (estado === 'ASISTENCIA') a++;
        else if (estado === 'FALTA') f++;
        else if (estado === 'RETARDO') r++;
        else if (estado === 'JUSTIFICADA') j++;
        return estado;
      });

      const total = a + f + r + j;
      const pct = total > 0 ? Math.round((a / total) * 100) : 0;
      const row = sheet.addRow([alumno.nombre, alumno.numeroControl ?? '', ...estados, a, f, r, j, `${pct}%`]);

      // Color cells by attendance state
      estados.forEach((estado, idx) => {
        const cell = row.getCell(3 + idx);
        cell.value = estado.charAt(0) || '';
        if (estadoColores[estado]) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estadoColores[estado] } };
        }
      });
    }

    // Totals row
    const totalRow = sheet.addRow(['TOTALES', '', ...sesiones.map(() => '')]);
    totalRow.font = { bold: true };

    sheet.columns.forEach((col) => { col.width = 14; });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarPdfAsistencias(datosReporte: {
    materia: any;
    sesiones: any[];
    alumnos: any[];
    asistencias: any[];
  }): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const { materia, sesiones, alumnos, asistencias } = datosReporte;

      doc.fontSize(14).font('Helvetica-Bold').text(`Reporte de Asistencias`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Materia: ${materia.nombre}  |  Docente: ${materia.docente?.nombre ?? ''}`, { align: 'center' });
      doc.moveDown();

      const mapaAsist = new Map<string, string>();
      for (const a of asistencias) {
        mapaAsist.set(`${a.alumnoId}_${a.claseSesionId}`, a.estado);
      }

      const colWidth = 45;
      const rowHeight = 18;
      let x = 30;
      let y = doc.y;

      // Draw headers
      doc.font('Helvetica-Bold').fontSize(8);
      doc.rect(x, y, 130, rowHeight).stroke().text('Alumno', x + 2, y + 4, { width: 126 });
      x += 130;
      sesiones.slice(0, 10).forEach((s) => {
        const label = new Date(s.fecha).toLocaleDateString('es-MX', { month: '2-digit', day: '2-digit' });
        doc.rect(x, y, colWidth, rowHeight).stroke().text(label, x + 2, y + 4, { width: colWidth - 4 });
        x += colWidth;
      });

      // Draw rows
      doc.font('Helvetica').fontSize(8);
      for (const alumno of alumnos) {
        x = 30;
        y += rowHeight;
        if (y > 550) { doc.addPage(); y = 30; }
        doc.rect(x, y, 130, rowHeight).stroke().text(alumno.nombre.substring(0, 22), x + 2, y + 4, { width: 126 });
        x += 130;
        sesiones.slice(0, 10).forEach((s) => {
          const estado = mapaAsist.get(`${alumno.id}_${s.id}`) ?? '-';
          const letra = { ASISTENCIA: 'A', FALTA: 'F', RETARDO: 'R', JUSTIFICADA: 'J' }[estado] ?? '-';
          doc.rect(x, y, colWidth, rowHeight).stroke().text(letra, x + 2, y + 4, { width: colWidth - 4, align: 'center' });
          x += colWidth;
        });
      }

      doc.end();
    });
  }

  async generarExcelTareas(materia: any, tareas: any[], entregas: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tareas');

    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = `Reporte de Tareas: ${materia.nombre}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const headerRow = sheet.addRow(['Alumno', 'Num. Control', ...tareas.map((t) => t.titulo)]);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    const mapaEntregas = new Map<string, any>();
    for (const e of entregas) {
      mapaEntregas.set(`${e.alumnoId}_${e.tareaId}`, e);
    }

    const alumnos = [...new Map(entregas.map((e) => [e.alumnoId, e.alumno])).values()];
    for (const alumno of alumnos) {
      const celdas = tareas.map((t) => {
        const entrega = mapaEntregas.get(`${alumno.id}_${t.id}`);
        if (!entrega) return '-';
        return entrega.calificacion != null ? entrega.calificacion : entrega.estadoRevision;
      });
      sheet.addRow([alumno.nombre, alumno.numeroControl ?? '', ...celdas]);
    }

    sheet.columns.forEach((col) => { col.width = 16; });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
