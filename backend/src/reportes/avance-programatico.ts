import * as ExcelJS from 'exceljs';
import { zonaHoraria } from '../common/zona-horaria.util';
import {
  bordesExcel,
  cabeceraExcel,
  crearPdfInstitucional,
  encabezadoExcel,
  firmas,
  observaciones,
  tabla,
  tablaDatos,
  tituloSeccion,
} from './formato-institucional';
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
  hoja.columns = [
    { width: 16 },
    { width: 6 },
    { width: 60 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
  ];
  encabezadoExcel(libro, hoja, formato(datos), 6);
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
  cabeceraExcel(cabecera);
  for (const unidad of datos.unidades) {
    if (!unidad.temas.length) {
      bordesExcel(hoja.addRow([unidad.nombre, '', 'Sin temario cargado']), 6);
      continue;
    }
    for (const tema of unidad.temas) {
      const fila = hoja.addRow([
        unidad.nombre,
        tema.orden,
        tema.nombre,
        tema.semana ?? '',
        fecha(tema.vistoEn),
        ESTADO[tema.estado],
      ]);
      bordesExcel(fila, 6);
    }
  }
  return Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}

function formato(datos: Avance) {
  return {
    titulo: 'Avance programático',
    subtitulo: [datos.materia.nombre, datos.grupo?.nombre]
      .filter(Boolean)
      .join(' · '),
  };
}

export function pdfAvance(datos: Avance): Promise<Buffer> {
  const { doc, terminar } = crearPdfInstitucional(formato(datos));
  tablaDatos(doc, resumen(datos));

  for (const unidad of datos.unidades) {
    const avance = unidad.avance;
    tituloSeccion(
      doc,
      `${unidad.nombre}${avance ? ` · ${avance.vistos} de ${avance.total} temas` : ''}`,
    );
    tabla(doc, {
      columnas: ['No.', 'Tema', 'Semana planeada', 'Visto el', 'Estado'],
      anchos: [7, 53, 14, 13, 13],
      alinear: ['center', 'left', 'center', 'center', 'center'],
      vacio: 'Sin temario cargado.',
      filas: unidad.temas.map((tema) => {
        const color = tema.estado === 'ATRASADO' ? '#b42318' : undefined;
        return [
          tema.orden,
          tema.nombre,
          tema.semana ?? '',
          fecha(tema.vistoEn),
          { texto: ESTADO[tema.estado], color },
        ];
      }),
    });
  }

  firmas(doc, [{ cargo: 'Docente', nombre: datos.materia.docente }]);
  observaciones(doc, [
    'Generado por SICAT a partir de la bitácora de clase; no sustituye el formato oficial.',
  ]);
  return terminar();
}
