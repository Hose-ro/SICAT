import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { zonaHoraria } from '../common/zona-horaria.util';
import type { TemarioService } from '../temario/temario.service';

/*
 * Reporte de avance programático de un grupo: cada tema con la semana en que
 * se planeó y la fecha en que se vio. No reproduce un formato oficial.
 */

type Avance = Awaited<ReturnType<TemarioService['obtener']>>;

const ESTADO = { VISTO: 'Visto', ATRASADO: 'Atrasado', PENDIENTE: 'Pendiente' };

function fecha(valor: Date | null) {
  return valor
    ? new Date(valor).toLocaleDateString('es-MX', {
        timeZone: zonaHoraria(),
        day: 'numeric',
        month: 'short',
      })
    : '';
}

function resumen(datos: Avance) {
  const avance = datos.avance;
  return [
    [
      'Materia',
      [datos.materia.clave, datos.materia.nombre].filter(Boolean).join(' '),
    ],
    ['Grupo', datos.grupo?.nombre ?? ''],
    ['Docente', datos.materia.docente ?? ''],
    [
      'Periodo',
      datos.periodo
        ? `${datos.periodo.clave} · semana ${datos.periodo.semanaActual} de ${datos.periodo.semanas}`
        : '',
    ],
    [
      'Avance',
      avance
        ? `${avance.vistos} de ${avance.total} temas (${avance.porcentaje} %) · planeados a esta semana: ${avance.planeadosALaFecha} · atrasados: ${avance.atrasados}`
        : '',
    ],
    [
      'Generado',
      new Date().toLocaleString('es-MX', {
        timeZone: zonaHoraria(),
        dateStyle: 'long',
        timeStyle: 'short',
      }),
    ],
  ] as const;
}

export async function excelAvance(datos: Avance): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Avance programático');
  hoja.addRow(['Avance programático']).font = { bold: true, size: 14 };
  for (const fila of resumen(datos)) hoja.addRow([...fila]);
  hoja.addRow([]);
  const cabecera = hoja.addRow([
    'Unidad',
    'No.',
    'Tema',
    'Semana planeada',
    'Visto el',
    'Estado',
  ]);
  cabecera.font = { bold: true };
  cabecera.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7EEF8' },
  };
  for (const unidad of datos.unidades) {
    if (!unidad.temas.length) {
      hoja.addRow([unidad.nombre, '', 'Sin temario cargado']);
      continue;
    }
    for (const tema of unidad.temas) {
      hoja.addRow([
        unidad.nombre,
        tema.orden,
        tema.nombre,
        tema.semana ?? '',
        fecha(tema.vistoEn),
        ESTADO[tema.estado],
      ]);
    }
  }
  hoja.columns = [
    { width: 16 },
    { width: 6 },
    { width: 60 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
  ];
  return Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}

export function pdfAvance(datos: Avance): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));

    doc.font('Helvetica-Bold').fontSize(14).text('Avance programático');
    doc.font('Helvetica').fontSize(9);
    for (const [etiqueta, valor] of resumen(datos)) {
      doc.text(`${etiqueta}: ${valor}`);
    }

    for (const unidad of datos.unidades) {
      doc.moveDown(0.8);
      const avance = unidad.avance;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(
          `${unidad.nombre}${avance ? ` · ${avance.vistos} de ${avance.total} temas` : ''}`,
        );
      doc.font('Helvetica').fontSize(9);
      if (!unidad.temas.length) {
        doc
          .fillColor('#6a7790')
          .text('Sin temario cargado.')
          .fillColor('black');
        continue;
      }
      for (const tema of unidad.temas) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 20)
          doc.addPage();
        const detalle = [
          tema.semana ? `semana ${tema.semana}` : null,
          tema.vistoEn
            ? `visto el ${fecha(tema.vistoEn)}`
            : ESTADO[tema.estado],
        ]
          .filter(Boolean)
          .join(' · ');
        doc
          .fillColor(tema.estado === 'ATRASADO' ? '#b42318' : 'black')
          .text(`${tema.orden}. ${tema.nombre} — ${detalle}`)
          .fillColor('black');
      }
    }
    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor('#6a7790')
      .text(
        'Generado por SICAT a partir de la bitácora de clase; no sustituye el formato oficial.',
      );
    doc.end();
  });
}
