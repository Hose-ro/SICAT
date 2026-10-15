import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { letraSexo } from '../common/sexo';
import { zonaHoraria } from '../common/zona-horaria.util';

/*
 * Concentrado de calificaciones del cierre de curso. No reproduce ningún
 * formato oficial: es el resumen que el docente revisa y del que copia al
 * sistema de la escuela. Con el curso abierto sale marcado como preliminar.
 */

type CeldaUnidad = {
  unidadId: number;
  calificacion: number | null;
  oportunidad: 1 | 2 | null;
  estado: string;
};

export type DatosConcentrado = {
  materia: { nombre: string; clave?: string | null };
  grupo: { nombre: string } | null;
  periodo: string;
  docente: string | null;
  cerradoEn: Date | string | null;
  unidades: Array<{ id: number; nombre: string; orden: number }>;
  alumnos: Array<{
    alumno: {
      nombre: string;
      numeroControl: string | null;
      sexo: string | null;
    };
    unidades: CeldaUnidad[];
    estado: string;
    final: number | null;
    nivel: string | null;
  }>;
};

const NIVEL: Record<string, string> = {
  EXCELENTE: 'Excelente',
  NOTABLE: 'Notable',
  BUENO: 'Bueno',
  SUFICIENTE: 'Suficiente',
  INSUFICIENTE: 'Insuficiente',
};
const RESULTADO: Record<string, string> = {
  ACREDITADO: 'Acreditado',
  NO_ACREDITADO: 'No acreditado',
  PENDIENTE: 'Pendiente',
};

function fechaHora(valor: Date | string) {
  return new Date(valor).toLocaleString('es-MX', {
    timeZone: zonaHoraria(),
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function textoUnidad(celda: CeldaUnidad | undefined) {
  if (!celda || celda.estado === 'SIN_CALIFICAR') return '';
  if (celda.calificacion == null) return 'NP';
  const valor = Math.round(celda.calificacion * 10) / 10;
  return celda.oportunidad === 2 ? `${valor} (2ª)` : `${valor}`;
}

function textoFinal(item: DatosConcentrado['alumnos'][number]) {
  if (item.estado === 'NO_ACREDITADO') return 'NA';
  return item.final == null ? '' : String(item.final);
}

/** Cuántos alcanzaron cada unidad en primera y en segunda oportunidad. */
export function indicesPorUnidad(datos: DatosConcentrado) {
  return datos.unidades.map((unidad) => {
    const celdas = datos.alumnos.map((item) =>
      item.unidades.find((celda) => celda.unidadId === unidad.id),
    );
    const contar = (estado: string) =>
      celdas.filter((celda) => celda?.estado === estado).length;
    const total = datos.alumnos.length;
    const primera = contar('ALCANZADA');
    const segunda = contar('ALCANZADA_SEGUNDA');
    const noAlcanzada = contar('NO_ALCANZADA');
    return {
      unidad,
      total,
      primera,
      segunda,
      noAlcanzada,
      aprobacion: total ? Math.round(((primera + segunda) / total) * 100) : 0,
      reprobacion: total ? Math.round((noAlcanzada / total) * 100) : 0,
    };
  });
}

function encabezado(datos: DatosConcentrado) {
  return [
    [
      'Materia',
      [datos.materia.clave, datos.materia.nombre].filter(Boolean).join(' '),
    ],
    ['Grupo', datos.grupo?.nombre ?? ''],
    ['Periodo', datos.periodo],
    ['Docente', datos.docente ?? ''],
    [
      'Estado',
      datos.cerradoEn
        ? `Curso cerrado el ${fechaHora(datos.cerradoEn)}`
        : 'PRELIMINAR: el curso sigue abierto y estas calificaciones pueden cambiar',
    ],
  ] as const;
}

export async function excelConcentrado(
  datos: DatosConcentrado,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Concentrado');
  hoja.addRow(['Concentrado de calificaciones']).font = {
    bold: true,
    size: 14,
  };
  for (const fila of encabezado(datos)) hoja.addRow([...fila]);
  hoja.addRow([
    'Unidades marcadas con (2ª) se acreditaron o evaluaron en segunda oportunidad. NP: no se presentó a la segunda oportunidad. NA: no acreditado.',
  ]);
  hoja.addRow([]);

  const cabecera = hoja.addRow([
    'No.',
    'No. control',
    'Alumno',
    'Sexo',
    ...datos.unidades.map((unidad) => unidad.nombre),
    'Final',
    'Nivel de desempeño',
    'Resultado',
  ]);
  cabecera.font = { bold: true };
  cabecera.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7EEF8' },
  };
  hoja.views = [{ state: 'frozen', ySplit: cabecera.number, xSplit: 3 }];

  datos.alumnos.forEach((item, indice) => {
    hoja.addRow([
      indice + 1,
      item.alumno.numeroControl ?? '',
      item.alumno.nombre,
      letraSexo(item.alumno.sexo),
      ...datos.unidades.map((unidad) =>
        textoUnidad(
          item.unidades.find((celda) => celda.unidadId === unidad.id),
        ),
      ),
      textoFinal(item),
      item.nivel ? NIVEL[item.nivel] : '',
      RESULTADO[item.estado] ?? item.estado,
    ]);
  });
  hoja.columns = [
    { width: 6 },
    { width: 14 },
    { width: 34 },
    { width: 6 },
    ...datos.unidades.map(() => ({ width: 12 })),
    { width: 8 },
    { width: 18 },
    { width: 16 },
  ];

  const indices = libro.addWorksheet('Índices por unidad');
  const titulo = indices.addRow([
    'Unidad',
    'Alumnos',
    'Alcanzaron en 1ª',
    'Alcanzaron en 2ª',
    'No alcanzaron',
    '% aprobación',
    '% reprobación',
  ]);
  titulo.font = { bold: true };
  for (const fila of indicesPorUnidad(datos)) {
    indices.addRow([
      fila.unidad.nombre,
      fila.total,
      fila.primera,
      fila.segunda,
      fila.noAlcanzada,
      fila.aprobacion / 100,
      fila.reprobacion / 100,
    ]);
  }
  indices.getColumn(6).numFmt = '0%';
  indices.getColumn(7).numFmt = '0%';
  indices.columns.forEach((columna, i) => {
    columna.width = i === 0 ? 22 : 16;
  });

  return Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}

export function pdfConcentrado(datos: DatosConcentrado): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape',
    });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Concentrado de calificaciones');
    doc.font('Helvetica').fontSize(9);
    for (const [etiqueta, valor] of encabezado(datos))
      doc.text(`${etiqueta}: ${valor}`);
    doc.moveDown(0.6);

    const ancho =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const fijas = [24, 64, 170, 26];
    const colas = [36, 70, 70];
    const porUnidad = Math.max(
      34,
      (ancho -
        fijas.reduce((a, b) => a + b, 0) -
        colas.reduce((a, b) => a + b, 0)) /
        Math.max(datos.unidades.length, 1),
    );
    const columnas = [
      ...fijas,
      ...datos.unidades.map(() => porUnidad),
      ...colas,
    ];
    const fila = (celdas: string[], negrita = false) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 18) doc.addPage();
      const y = doc.y;
      let x = doc.page.margins.left;
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      celdas.forEach((texto, i) => {
        doc.text(texto, x + 2, y, {
          width: columnas[i] - 4,
          lineBreak: false,
          ellipsis: true,
        });
        x += columnas[i];
      });
      doc
        .moveTo(doc.page.margins.left, y + 12)
        .lineTo(doc.page.margins.left + ancho, y + 12)
        .strokeColor('#dde2ee')
        .lineWidth(0.5)
        .stroke();
      doc.y = y + 15;
    };

    fila(
      [
        'No.',
        'Control',
        'Alumno',
        'Sexo',
        ...datos.unidades.map((unidad) => `U${unidad.orden}`),
        'Final',
        'Nivel',
        'Resultado',
      ],
      true,
    );
    datos.alumnos.forEach((item, indice) =>
      fila([
        String(indice + 1),
        item.alumno.numeroControl ?? '',
        item.alumno.nombre,
        letraSexo(item.alumno.sexo),
        ...datos.unidades.map((unidad) =>
          textoUnidad(
            item.unidades.find((celda) => celda.unidadId === unidad.id),
          ),
        ),
        textoFinal(item),
        item.nivel ? NIVEL[item.nivel] : '',
        RESULTADO[item.estado] ?? item.estado,
      ]),
    );

    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Índices por unidad', doc.page.margins.left);
    doc.font('Helvetica').fontSize(9);
    for (const indice of indicesPorUnidad(datos)) {
      doc.text(
        `${indice.unidad.nombre}: ${indice.primera} en 1ª, ${indice.segunda} en 2ª, ${indice.noAlcanzada} no alcanzaron — aprobación ${indice.aprobacion} %, reprobación ${indice.reprobacion} %`,
      );
    }
    doc.moveDown(0.4);
    doc
      .fontSize(8)
      .fillColor('#6a7790')
      .text(
        '(2ª) segunda oportunidad · NP no se presentó · NA no acreditado. Generado por SICAT; no sustituye el acta oficial.',
      );
    doc.end();
  });
}
