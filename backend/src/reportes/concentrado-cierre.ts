import * as ExcelJS from 'exceljs';
import { letraSexo } from '../common/sexo';
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
  if (celda.calificacion == null) return 'NA';
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

function formato(datos: DatosConcentrado) {
  return {
    titulo: 'Concentrado de calificaciones',
    subtitulo: [datos.materia.nombre, datos.grupo?.nombre]
      .filter(Boolean)
      .join(' · '),
  };
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
  const totalColumnas = 4 + datos.unidades.length + 3;
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
  encabezadoExcel(libro, hoja, formato(datos), totalColumnas);
  for (const fila of encabezado(datos)) hoja.addRow([...fila]);
  hoja.addRow([
    '(2ª): calificación de segunda oportunidad. NA en una unidad: reprobada en segunda oportunidad; NA en la final: curso no acreditado.',
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
  cabeceraExcel(cabecera);
  hoja.views = [{ state: 'frozen', ySplit: cabecera.number, xSplit: 3 }];

  datos.alumnos.forEach((item, indice) => {
    const fila = hoja.addRow([
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
    bordesExcel(fila, totalColumnas);
  });

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
  const { doc, terminar } = crearPdfInstitucional(formato(datos), {
    layout: 'landscape',
  });
  tablaDatos(doc, encabezado(datos));

  tituloSeccion(doc, 'Calificaciones');
  tabla(doc, {
    columnas: [
      'No.',
      'Control',
      'Alumno',
      'Sexo',
      ...datos.unidades.map((unidad) => `U${unidad.orden}`),
      'Final',
      'Nivel',
      'Resultado',
    ],
    anchos: [24, 64, 170, 30, ...datos.unidades.map(() => 38), 38, 70, 74],
    alinear: [
      'center',
      'left',
      'left',
      'center',
      ...datos.unidades.map(() => 'center' as const),
      'center',
      'left',
      'left',
    ],
    tamano: 8,
    vacio: 'Sin alumnos en el padrón.',
    filas: datos.alumnos.map((item, indice) => [
      indice + 1,
      item.alumno.numeroControl ?? '',
      item.alumno.nombre,
      letraSexo(item.alumno.sexo),
      ...datos.unidades.map((unidad) =>
        textoUnidad(
          item.unidades.find((celda) => celda.unidadId === unidad.id),
        ),
      ),
      { texto: textoFinal(item), negrita: true },
      item.nivel ? NIVEL[item.nivel] : '',
      RESULTADO[item.estado] ?? item.estado,
    ]),
  });

  tituloSeccion(doc, 'Índices por unidad');
  tabla(doc, {
    columnas: [
      'Unidad',
      'Alumnos',
      'Alcanzaron en 1ª',
      'Alcanzaron en 2ª',
      'No alcanzaron',
      '% aprobación',
      '% reprobación',
    ],
    anchos: [30, 10, 12, 12, 12, 12, 12],
    alinear: [
      'left',
      'center',
      'center',
      'center',
      'center',
      'center',
      'center',
    ],
    filas: indicesPorUnidad(datos).map((indice) => [
      indice.unidad.nombre,
      indice.total,
      indice.primera,
      indice.segunda,
      indice.noAlcanzada,
      `${indice.aprobacion} %`,
      `${indice.reprobacion} %`,
    ]),
  });

  firmas(doc, [{ cargo: 'Docente', nombre: datos.docente }]);
  observaciones(doc, [
    '(2ª) segunda oportunidad · NA reprobada o no acreditado. Generado por SICAT; no sustituye el acta oficial.',
  ]);
  return terminar();
}
