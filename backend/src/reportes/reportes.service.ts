import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportesService {
  async generarExcelAsistencias(datosReporte: {
    materia: any;
    filtros?: any;
    sesiones: any[];
    alumnos: any[];
    asistencias: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asistencias');

    const { materia, filtros, sesiones, alumnos, asistencias } = datosReporte;

    // Header info
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value =
      `Materia: ${materia.nombre} | Docente: ${materia.docente?.nombre ?? ''}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    if (filtros) {
      sheet.mergeCells('A2:E2');
      sheet.getCell('A2').value = [
        filtros.grupoId ? `Grupo: ${filtros.grupoId}` : null,
        filtros.fecha ? `Fecha: ${filtros.fecha}` : null,
        filtros.semana ? `Semana: ${filtros.semana}` : null,
        filtros.unidadId ? `Unidad: ${filtros.unidadId}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      sheet.getCell('A2').font = { italic: true, size: 11 };
    }

    // Column headers
    const headerRow = sheet.addRow([
      'Alumno',
      'Num. Control',
      ...sesiones.map((s) => new Date(s.fecha).toLocaleDateString('es-MX')),
      'A',
      'F',
      'R',
      'J',
      '%',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };

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
      let a = 0,
        f = 0,
        r = 0,
        j = 0;
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
      const row = sheet.addRow([
        alumno.nombre,
        alumno.numeroControl ?? '',
        ...estados,
        a,
        f,
        r,
        j,
        `${pct}%`,
      ]);

      // Color cells by attendance state
      estados.forEach((estado, idx) => {
        const cell = row.getCell(3 + idx);
        cell.value = estado.charAt(0) || '';
        if (estadoColores[estado]) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: estadoColores[estado] },
          };
        }
      });
    }

    // Totals row
    const totalRow = sheet.addRow(['TOTALES', '', ...sesiones.map(() => '')]);
    totalRow.font = { bold: true };

    sheet.columns.forEach((col) => {
      col.width = 14;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarPdfAsistencias(datosReporte: {
    materia: any;
    filtros?: any;
    sesiones: any[];
    alumnos: any[];
    asistencias: any[];
  }): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const { materia, filtros, sesiones, alumnos, asistencias } = datosReporte;

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`Reporte de Asistencias`, { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Materia: ${materia.nombre}  |  Docente: ${materia.docente?.nombre ?? ''}`,
          { align: 'center' },
        );
      if (filtros) {
        const descripcion = [
          filtros.grupoId ? `Grupo ${filtros.grupoId}` : null,
          filtros.fecha ? `Fecha ${filtros.fecha}` : null,
          filtros.semana ? `Semana ${filtros.semana}` : null,
          filtros.unidadId ? `Unidad ${filtros.unidadId}` : null,
        ]
          .filter(Boolean)
          .join(' | ');
        if (descripcion) {
          doc.fontSize(9).text(descripcion, { align: 'center' });
        }
      }
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
      doc
        .rect(x, y, 130, rowHeight)
        .stroke()
        .text('Alumno', x + 2, y + 4, { width: 126 });
      x += 130;
      sesiones.slice(0, 10).forEach((s) => {
        const label = new Date(s.fecha).toLocaleDateString('es-MX', {
          month: '2-digit',
          day: '2-digit',
        });
        doc
          .rect(x, y, colWidth, rowHeight)
          .stroke()
          .text(label, x + 2, y + 4, { width: colWidth - 4 });
        x += colWidth;
      });

      // Draw rows
      doc.font('Helvetica').fontSize(8);
      for (const alumno of alumnos) {
        x = 30;
        y += rowHeight;
        if (y > 550) {
          doc.addPage();
          y = 30;
        }
        doc
          .rect(x, y, 130, rowHeight)
          .stroke()
          .text(alumno.nombre.substring(0, 22), x + 2, y + 4, { width: 126 });
        x += 130;
        sesiones.slice(0, 10).forEach((s) => {
          const estado = mapaAsist.get(`${alumno.id}_${s.id}`) ?? '-';
          const letra =
            { ASISTENCIA: 'A', FALTA: 'F', RETARDO: 'R', JUSTIFICADA: 'J' }[
              estado
            ] ?? '-';
          doc
            .rect(x, y, colWidth, rowHeight)
            .stroke()
            .text(letra, x + 2, y + 4, {
              width: colWidth - 4,
              align: 'center',
            });
          x += colWidth;
        });
      }

      doc.end();
    });
  }

  async generarExcelTareas(
    materia: any,
    tareas: any[],
    entregas: any[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tareas');

    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = `Reporte de Tareas: ${materia.nombre}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const headerRow = sheet.addRow([
      'Alumno',
      'Num. Control',
      ...tareas.map((t) => t.titulo),
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };

    const mapaEntregas = new Map<string, any>();
    for (const e of entregas) {
      mapaEntregas.set(`${e.alumnoId}_${e.tareaId}`, e);
    }

    const alumnos = [
      ...new Map(entregas.map((e) => [e.alumnoId, e.alumno])).values(),
    ];
    for (const alumno of alumnos) {
      const celdas = tareas.map((t) => {
        const entrega = mapaEntregas.get(`${alumno.id}_${t.id}`);
        if (!entrega) return '-';
        return entrega.calificacion != null
          ? entrega.calificacion
          : entrega.estadoRevision;
      });
      sheet.addRow([alumno.nombre, alumno.numeroControl ?? '', ...celdas]);
    }

    sheet.columns.forEach((col) => {
      col.width = 16;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarExcelReporteTareas(reporte: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const resumen = workbook.addWorksheet('Resumen');
    const alumnos = workbook.addWorksheet('Alumnos');
    const matriz = workbook.addWorksheet('Matriz');

    resumen.mergeCells('A1:F1');
    resumen.getCell('A1').value = 'Reporte de tareas SICAT';
    resumen.getCell('A1').font = { bold: true, size: 16 };
    resumen.addRow([]);
    resumen.addRow([
      'Generado en',
      new Date(reporte.generatedAt).toLocaleString('es-MX'),
    ]);
    resumen.addRow([
      'Porcentaje de entrega',
      `${reporte.metrics?.porcentajeEntrega ?? 0}%`,
    ]);
    resumen.addRow(['Tareas vencidas', reporte.metrics?.tareasVencidas ?? 0]);
    resumen.addRow(['Entregas tardías', reporte.metrics?.entregasTardias ?? 0]);
    resumen.addRow([
      'Pendientes de revisión',
      reporte.metrics?.pendientesRevision ?? 0,
    ]);

    resumen.addRow([]);
    const taskHeader = resumen.addRow([
      'Tarea',
      'Materia',
      'Grupo',
      'Unidad',
      'Estado',
      '% Entrega',
      'Entregadas',
      'No entregadas',
      'Tardías',
      'Pendientes',
      'Promedio',
      'Fecha límite',
    ]);
    taskHeader.font = { bold: true };
    taskHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7EEF8' },
    };

    for (const task of reporte.tasks ?? []) {
      resumen.addRow([
        task.titulo,
        task.materia?.nombre ?? '',
        task.grupo?.nombre ?? '',
        task.unidadRef?.nombre ??
          (task.unidad ? `Unidad ${task.unidad}` : 'Sin unidad'),
        task.estado,
        `${task.porcentajeEntrega ?? 0}%`,
        task.entregadas ?? 0,
        task.noEntregadas ?? 0,
        task.entregasTardias ?? 0,
        task.pendientesRevision ?? 0,
        task.promedio ?? '',
        task.fechaLimite
          ? new Date(task.fechaLimite).toLocaleString('es-MX')
          : 'Sin límite',
      ]);
    }
    resumen.columns.forEach((column) => {
      column.width = 18;
    });

    const studentHeader = alumnos.addRow([
      'Alumno',
      'No. control',
      'Pendientes',
      'Entregadas',
      'Tardías',
      'Promedio',
    ]);
    studentHeader.font = { bold: true };
    studentHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5E8D5' },
    };
    for (const student of reporte.students ?? []) {
      alumnos.addRow([
        student.nombre,
        student.numeroControl ?? '',
        student.pendientes ?? 0,
        student.entregadas ?? 0,
        student.tardias ?? 0,
        student.promedio ?? '',
      ]);
    }
    alumnos.columns.forEach((column) => {
      column.width = 18;
    });

    const taskColumns = [
      'Alumno',
      'No. control',
      ...(reporte.tasks ?? []).map((task) => task.titulo),
    ];
    const matrixHeader = matriz.addRow(taskColumns);
    matrixHeader.font = { bold: true };
    matrixHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDDEBF7' },
    };
    for (const student of reporte.students ?? []) {
      const byTask = new Map(
        (student.tasks ?? []).map((task) => [task.tareaId, task]),
      );
      const row = (reporte.tasks ?? []).map((task) => {
        const status: any = byTask.get(task.id);
        if (!status) return '-';
        if (typeof status.calificacion === 'number') return status.calificacion;
        return status.estado;
      });
      matriz.addRow([student.nombre, student.numeroControl ?? '', ...row]);
    }
    matriz.columns.forEach((column) => {
      column.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarPdfReporteTareas(reporte: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).font('Helvetica-Bold').text('Reporte de tareas SICAT');
      doc.moveDown(0.4);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Generado: ${new Date(reporte.generatedAt).toLocaleString('es-MX')}`,
        );
      doc.text(
        `Porcentaje de entrega: ${reporte.metrics?.porcentajeEntrega ?? 0}%`,
      );
      doc.text(`Tareas vencidas: ${reporte.metrics?.tareasVencidas ?? 0}`);
      doc.text(`Entregas tardías: ${reporte.metrics?.entregasTardias ?? 0}`);
      doc.text(
        `Pendientes de revisión: ${reporte.metrics?.pendientesRevision ?? 0}`,
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Tareas', { underline: true });
      doc.moveDown(0.4);
      for (const task of (reporte.tasks ?? []).slice(0, 18)) {
        doc.font('Helvetica-Bold').fontSize(10).text(task.titulo);
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(
            [
              task.materia?.nombre ?? '',
              task.grupo?.nombre ?? '',
              task.unidadRef?.nombre ??
                (task.unidad ? `Unidad ${task.unidad}` : 'Sin unidad'),
              task.estado,
            ]
              .filter(Boolean)
              .join(' | '),
          );
        doc.text(
          `Entrega ${task.porcentajeEntrega ?? 0}% | Tardías ${task.entregasTardias ?? 0} | Promedio ${task.promedio ?? '-'}`,
        );
        doc.moveDown(0.5);
      }

      doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Alumnos con más pendientes', { underline: true });
      doc.moveDown(0.4);
      for (const student of (reporte.alumnosConMasPendientes ?? []).slice(
        0,
        20,
      )) {
        doc.font('Helvetica-Bold').fontSize(10).text(student.nombre);
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(
            `Control ${student.numeroControl ?? '-'} | Pendientes ${student.pendientes ?? 0} | Tardías ${student.tardias ?? 0} | Promedio ${student.promedio ?? '-'}`,
          );
        doc.moveDown(0.35);
      }

      doc.end();
    });
  }
}
