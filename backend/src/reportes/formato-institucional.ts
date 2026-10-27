import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/*
 * Formato institucional de los documentos que genera SICAT. Sigue el acta de
 * academia (F01PSA01.02): recuadro con los logotipos a la izquierda; a la
 * derecha el nombre del instituto, el del documento y la referencia a la
 * norma; tablas con borde negro, títulos de sección centrados y "PÁGINA n"
 * al pie. El reporte parcial del semestre conserva su propio formato.
 */

export const INSTITUCION = 'INSTITUTO TECNOLÓGICO SUPERIOR DE COSAMALOAPAN';
const NORMA = 'Referencia a la Norma ISO 9001/2008:';
const APARTADO = '8.2 Seguimiento y Medición.';

export type Formato = {
  /** Nombre del documento, debajo del instituto. */
  titulo: string;
  /** Segunda línea: la materia, la carrera… */
  subtitulo?: string;
  /** Clave del formato, a la derecha bajo el recuadro. */
  codigo?: string;
};

export type Celda =
  | string
  | number
  | { texto: string | number; color?: string; negrita?: boolean };

function rutaActivo(nombre: string) {
  const candidatos = [
    join(process.cwd(), 'src/reportes/assets', nombre),
    join(process.cwd(), 'dist/reportes/assets', nombre),
    join(__dirname, 'assets', nombre),
  ];
  return candidatos.find((ruta) => existsSync(ruta)) ?? candidatos[0];
}

let logos: { itsco: Buffer; sev: Buffer } | null = null;
function cargarLogos() {
  logos ??= {
    itsco: readFileSync(rutaActivo('itsco-logo.png')),
    sev: readFileSync(rutaActivo('sev-logo.png')),
  };
  return logos;
}
/** Proporción ancho/alto del logotipo SEV. */
const SEV_PROPORCION = 600 / 284;

const NEGRO = '#000000';
const GRIS = '#555555';
const ARRIBA = 28;

type Doc = PDFKit.PDFDocument;

const anchoUtil = (doc: Doc) =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;
const limite = (doc: Doc) => doc.page.height - doc.page.margins.bottom;

function asegurarEspacio(doc: Doc, alto: number) {
  if (doc.y + alto > limite(doc)) doc.addPage();
}

/**
 * Documento carta con el encabezado del formato en la primera página. Se
 * escribe sobre `doc` y `terminar()` agrega el pie y devuelve el PDF.
 */
export function crearPdfInstitucional(
  formato: Formato,
  opciones: { layout?: 'portrait' | 'landscape' } = {},
) {
  const doc = new PDFDocument({
    size: 'LETTER',
    layout: opciones.layout ?? 'portrait',
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: formato.titulo, Author: 'SICAT' },
  });
  const partes: Buffer[] = [];
  doc.on('data', (parte: Buffer) => partes.push(parte));
  const listo = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  encabezadoPdf(doc, formato);
  return {
    doc,
    terminar: () => {
      piePdf(doc);
      doc.end();
      return listo;
    },
  };
}

function encabezadoPdf(doc: Doc, formato: Formato) {
  const { itsco, sev } = cargarLogos();
  const x = doc.page.margins.left;
  const ancho = anchoUtil(doc);
  const anchoLogos = Math.min(Math.round(ancho * 0.29), 190);
  const xDerecha = x + anchoLogos;
  const anchoDerecha = ancho - anchoLogos;

  // El nombre del instituto va en un solo renglón, como en el acta.
  const anchoTexto = anchoDerecha - 16;
  let tamanoInstitucion = 13;
  doc.font('Helvetica-Bold');
  while (
    tamanoInstitucion > 10 &&
    doc.fontSize(tamanoInstitucion).widthOfString(INSTITUCION) > anchoTexto
  ) {
    tamanoInstitucion -= 0.5;
  }
  const lineas = [
    { texto: INSTITUCION, tamano: tamanoInstitucion },
    { texto: formato.titulo, tamano: 11 },
    ...(formato.subtitulo ? [{ texto: formato.subtitulo, tamano: 11 }] : []),
  ];
  const altos = lineas.map(({ texto, tamano }) =>
    doc.fontSize(tamano).heightOfString(texto, { width: anchoTexto }),
  );
  const separacion = 7;
  const altoTextos =
    altos.reduce((a, b) => a + b, 0) + separacion * (lineas.length - 1);
  const altoSuperior = Math.max(79, altoTextos + 22);
  const altoReferencia = 31;
  const alto = altoSuperior + altoReferencia;

  doc.lineWidth(0.75).strokeColor(NEGRO);
  doc.rect(x, ARRIBA, ancho, alto).stroke();
  doc
    .moveTo(xDerecha, ARRIBA)
    .lineTo(xDerecha, ARRIBA + alto)
    .stroke();
  doc
    .moveTo(xDerecha, ARRIBA + altoSuperior)
    .lineTo(x + ancho, ARRIBA + altoSuperior)
    .stroke();

  // Logotipos lado a lado, centrados en su celda.
  const lado = Math.min(alto - 30, 72);
  const anchoSev = Math.min(anchoLogos - lado - 22, lado * 1.35);
  const altoSev = anchoSev / SEV_PROPORCION;
  const xLogos = x + (anchoLogos - (lado + 6 + anchoSev)) / 2;
  doc.image(itsco, xLogos, ARRIBA + (alto - lado) / 2, { fit: [lado, lado] });
  doc.image(sev, xLogos + lado + 6, ARRIBA + (alto - altoSev) / 2, {
    width: anchoSev,
  });

  let y = ARRIBA + (altoSuperior - altoTextos) / 2;
  doc.fillColor(NEGRO);
  lineas.forEach(({ texto, tamano }, i) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(tamano)
      .text(texto, xDerecha + 8, y, { width: anchoTexto, align: 'center' });
    y += altos[i] + separacion;
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(`${NORMA} `, xDerecha + 10, ARRIBA + altoSuperior + 10, {
      width: anchoDerecha - 20,
      continued: true,
      lineBreak: false,
    })
    .font('Helvetica')
    .text(APARTADO, { lineBreak: false });

  let abajo = ARRIBA + alto;
  if (formato.codigo) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(GRIS)
      .text(formato.codigo, x, abajo + 3, { width: ancho - 3, align: 'right' });
    abajo += 12;
  }
  doc.fillColor(NEGRO);
  doc.x = x;
  doc.y = abajo + 18;
}

function piePdf(doc: Doc) {
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    // Sin margen inferior el pie no abre otra página.
    const margen = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(GRIS)
      .text(
        `PÁGINA ${i + 1} DE ${paginas.count}`,
        doc.page.margins.left,
        doc.page.height - 32,
        { width: anchoUtil(doc), align: 'right', lineBreak: false },
      );
    doc.page.margins.bottom = margen;
  }
}

/** Título de sección centrado en mayúsculas ("ORDEN DEL DÍA"). */
export function tituloSeccion(doc: Doc, texto: string) {
  doc.moveDown(0.6);
  asegurarEspacio(doc, 70);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(NEGRO)
    .text(texto.toUpperCase(), doc.page.margins.left, doc.y, {
      width: anchoUtil(doc),
      align: 'center',
    });
  doc.moveDown(0.6);
}

export function parrafo(
  doc: Doc,
  texto: string,
  opciones: { tamano?: number; color?: string; negrita?: boolean } = {},
) {
  doc
    .font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opciones.tamano ?? 10)
    .fillColor(opciones.color ?? NEGRO)
    .text(texto, doc.page.margins.left, doc.y, { width: anchoUtil(doc) });
  doc.fillColor(NEGRO).moveDown(0.3);
}

const normalizar = (celda: Celda) =>
  typeof celda === 'object'
    ? { ...celda, texto: String(celda.texto) }
    : { texto: String(celda) };

/**
 * Tabla con borde negro como las del acta: encabezado en negritas centrado
 * y, si no cabe, sigue en la página siguiente repitiendo el encabezado.
 * `anchos` son proporciones.
 */
export function tabla(
  doc: Doc,
  opciones: {
    columnas?: string[];
    anchos: number[];
    filas: Celda[][];
    alinear?: Array<'left' | 'center' | 'right'>;
    tamano?: number;
    vacio?: string;
  },
) {
  const izquierda = doc.page.margins.left;
  const ancho = anchoUtil(doc);
  const total = opciones.anchos.reduce((a, b) => a + b, 0);
  const anchos = opciones.anchos.map((a) => (a / total) * ancho);
  const tamano = opciones.tamano ?? 9;
  const relleno = 5;

  const fila = (celdas: Celda[], cabecera: boolean, columnas = anchos) => {
    const textos = celdas.map(normalizar);
    const fuente = (negrita?: boolean) =>
      doc
        .font(cabecera || negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(tamano);
    const altos = textos.map(
      (c, i) =>
        fuente(c.negrita).heightOfString(c.texto || ' ', {
          width: columnas[i] - relleno * 2,
        }) +
        relleno * 2,
    );
    const alto = Math.max(cabecera ? 23 : 20, ...altos);
    if (doc.y + alto > limite(doc)) {
      doc.addPage();
      if (!cabecera && opciones.columnas) fila(opciones.columnas, true);
    }
    const y = doc.y;
    let x = izquierda;
    textos.forEach((c, i) => {
      doc
        .lineWidth(0.75)
        .strokeColor(NEGRO)
        .rect(x, y, columnas[i], alto)
        .stroke();
      fuente(c.negrita)
        .fillColor(c.color ?? NEGRO)
        .text(c.texto, x + relleno, y + (alto - altos[i]) / 2 + relleno, {
          width: columnas[i] - relleno * 2,
          align: cabecera
            ? 'center'
            : columnas === anchos
              ? (opciones.alinear?.[i] ?? 'left')
              : 'center',
        });
      x += columnas[i];
    });
    doc.fillColor(NEGRO);
    doc.x = izquierda;
    doc.y = y + alto;
  };

  if (opciones.columnas) fila(opciones.columnas, true);
  if (!opciones.filas.length && opciones.vacio) {
    fila([opciones.vacio], false, [ancho]);
  }
  opciones.filas.forEach((celdas) => fila(celdas, false));
  doc.moveDown(0.8);
}

/**
 * Datos generales (materia, grupo, docente…) en una tabla de etiqueta y
 * valor; en horizontal van dos pares por renglón.
 */
export function tablaDatos(
  doc: Doc,
  pares: ReadonlyArray<readonly [string, string]>,
) {
  const porRenglon = anchoUtil(doc) > 600 ? 2 : 1;
  const filas: Celda[][] = [];
  for (let i = 0; i < pares.length; i += porRenglon) {
    const renglon: Celda[] = [];
    for (let j = 0; j < porRenglon; j++) {
      const par = pares[i + j];
      renglon.push({ texto: par?.[0] ?? '', negrita: true }, par?.[1] ?? '');
    }
    filas.push(renglon);
  }
  tabla(doc, {
    anchos: porRenglon === 2 ? [15, 35, 15, 35] : [28, 72],
    filas,
  });
}

/**
 * Cuadro de firmas del acta: cargo, nombre y el espacio para firmar.
 */
export function firmas(
  doc: Doc,
  firmantes: Array<{ cargo: string; nombre?: string | null }>,
) {
  const ancho = anchoUtil(doc) * (firmantes.length === 1 ? 0.5 : 1);
  const columna = ancho / firmantes.length;
  const inicio = doc.page.margins.left + (anchoUtil(doc) - ancho) / 2;
  doc.moveDown(1.2);
  asegurarEspacio(doc, 23 + 27 + 46);
  const renglones = [
    {
      alto: 23,
      negrita: true,
      texto: (f: (typeof firmantes)[number]) => f.cargo.toUpperCase(),
    },
    {
      alto: 27,
      negrita: false,
      texto: (f: (typeof firmantes)[number]) => f.nombre || ' ',
    },
    { alto: 46, negrita: false, texto: () => 'FIRMA', abajo: true },
  ];
  let y = doc.y;
  for (const renglon of renglones) {
    firmantes.forEach((firmante, i) => {
      const x = inicio + columna * i;
      doc
        .lineWidth(0.75)
        .strokeColor(NEGRO)
        .rect(x, y, columna, renglon.alto)
        .stroke();
      doc
        .font(renglon.negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(renglon.negrita ? 9 : 10)
        .fillColor(NEGRO)
        .text(
          renglon.texto(firmante),
          x + 5,
          renglon.abajo ? y + renglon.alto - 17 : y + (renglon.alto - 10) / 2,
          {
            width: columna - 10,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          },
        );
    });
    y += renglon.alto;
  }
  doc.x = doc.page.margins.left;
  doc.y = y;
  doc.moveDown(0.8);
}

/** Sección final del acta; sin notas dice "Sin observaciones." */
export function observaciones(doc: Doc, notas: string[]) {
  tituloSeccion(doc, 'Observaciones');
  const textos = notas.filter(Boolean);
  for (const nota of textos.length ? textos : ['Sin observaciones.']) {
    parrafo(doc, nota);
  }
}

// ── Excel ──────────────────────────────────────────────────────────────────

const pxColumna = (ancho?: number) => Math.round((ancho ?? 9) * 7 + 5);

/** Columna fraccionaria de ExcelJS que corresponde a `px` desde la izquierda. */
function columnaEnPx(hoja: ExcelJS.Worksheet, px: number) {
  let restante = px;
  for (let i = 1; i < 200; i++) {
    const ancho = pxColumna(hoja.getColumn(i).width);
    if (restante < ancho) return i - 1 + restante / ancho;
    restante -= ancho;
  }
  return 0;
}

const BORDE_EXCEL: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

/**
 * Encabezado del formato en las filas 1 a 5 de la hoja; lo siguiente que se
 * agregue queda en la fila 6. Llamarlo con los anchos de columna ya puestos:
 * de ellos depende dónde caen los logotipos.
 */
export function encabezadoExcel(
  libro: ExcelJS.Workbook,
  hoja: ExcelJS.Worksheet,
  formato: Formato,
  totalColumnas: number,
) {
  const columnas = Math.max(totalColumnas, 2);
  // Los logotipos ocupan las primeras columnas hasta juntar ~180 px, sin
  // tragarse una columna ancha (la del tema o el alumno) si ya caben.
  let deLogos = 0;
  let px = 0;
  while (deLogos < columnas - 1 && px < 180) {
    const siguiente = px + pxColumna(hoja.getColumn(deLogos + 1).width);
    if (px >= 110 && siguiente > 260) break;
    deLogos += 1;
    px = siguiente;
  }

  const alturas = [26, 20, 20, 24];
  alturas.forEach((alto, i) => (hoja.getRow(i + 1).height = alto));
  for (let fila = 1; fila <= 4; fila++) {
    for (let col = 1; col <= columnas; col++) {
      hoja.getCell(fila, col).border = BORDE_EXCEL;
    }
  }
  hoja.mergeCells(1, 1, 4, deLogos);

  const textos: Array<[number, string, number]> = [
    [1, INSTITUCION, 13],
    [2, formato.titulo, 11],
    [3, formato.subtitulo ?? '', 11],
  ];
  for (const [fila, texto, tamano] of textos) {
    hoja.mergeCells(fila, deLogos + 1, fila, columnas);
    const celda = hoja.getCell(fila, deLogos + 1);
    celda.value = texto;
    celda.font = { name: 'Arial', bold: true, size: tamano };
    celda.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
  }
  hoja.mergeCells(4, deLogos + 1, 4, columnas);
  const referencia = hoja.getCell(4, deLogos + 1);
  referencia.value = {
    richText: [
      { text: `${NORMA} `, font: { name: 'Arial', bold: true, size: 10 } },
      { text: APARTADO, font: { name: 'Arial', size: 10 } },
    ],
  };
  referencia.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  if (formato.codigo) {
    const codigo = hoja.getCell(5, columnas);
    codigo.value = formato.codigo;
    codigo.font = { name: 'Arial', size: 8, color: { argb: 'FF555555' } };
    codigo.alignment = { horizontal: 'right' };
  }
  hoja.getRow(5).height = 14;

  const { itsco, sev } = cargarLogos();
  const altoBloque = alturas.reduce((a, b) => a + b, 0) * (4 / 3);
  const lado = 76;
  const anchoSev = Math.min(px - lado - 18, 104);
  const altoSev = anchoSev / SEV_PROPORCION;
  const inicio = Math.max(4, (px - (lado + 6 + anchoSev)) / 2);
  const filaEnPx = (y: number) => {
    let restante = y;
    for (let i = 0; i < alturas.length; i++) {
      const alto = alturas[i] * (4 / 3);
      if (restante < alto) return i + restante / alto;
      restante -= alto;
    }
    return alturas.length;
  };
  const escudo = libro.addImage({ buffer: itsco as never, extension: 'png' });
  const logoSev = libro.addImage({ buffer: sev as never, extension: 'png' });
  hoja.addImage(escudo, {
    tl: {
      col: columnaEnPx(hoja, inicio),
      row: filaEnPx((altoBloque - lado) / 2),
    } as never,
    ext: { width: lado, height: lado },
    editAs: 'oneCell',
  });
  hoja.addImage(logoSev, {
    tl: {
      col: columnaEnPx(hoja, inicio + lado + 6),
      row: filaEnPx((altoBloque - altoSev) / 2),
    } as never,
    ext: { width: anchoSev, height: altoSev },
    editAs: 'oneCell',
  });
}

/** Encabezado de tabla en Excel con el estilo del formato. */
export function cabeceraExcel(fila: ExcelJS.Row) {
  fila.font = { name: 'Arial', bold: true, size: 10 };
  fila.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  fila.eachCell((celda) => (celda.border = BORDE_EXCEL));
}

/** Borde negro a las celdas con datos de una fila. */
export function bordesExcel(fila: ExcelJS.Row, totalColumnas: number) {
  for (let col = 1; col <= totalColumnas; col++) {
    fila.getCell(col).border = BORDE_EXCEL;
  }
}
