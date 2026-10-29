import * as ExcelJS from 'exceljs';
import { CalificacionesService } from '../calificaciones/calificaciones.service';
import { PrismaService } from '../prisma.service';
import { ReporteParcialService } from './reporte-parcial.service';

const conteo = (hombres: number, mujeres: number, sinDato = 0) => ({
  hombres,
  mujeres,
  sinDato,
  total: hombres + mujeres + sinDato,
});

function crear() {
  return new ReporteParcialService(
    {} as PrismaService,
    {} as CalificacionesService,
  );
}

function muestra() {
  const fila = {
    materia: { id: 4, nombre: 'Redes de computadoras', clave: 'SCD-1021' },
    unidad: { id: 9, nombre: 'Unidad 1', orden: 1, status: 'ACTIVA' },
    semestre: 5,
    grupo: { id: 6, nombre: '503-A' },
    total: conteo(15, 6),
    po: conteo(12, 5),
    so: conteo(1, 0),
    acreditados: conteo(13, 5),
    porcentajeAcreditados: conteo(87, 83),
    noAcreditados: conteo(2, 1),
    porcentajeNoAcreditados: conteo(13, 17),
    desertores: conteo(0, 0),
    porcentajeDesertores: conteo(0, 0),
    pendientes: 1,
  };
  return {
    institucion: 'Instituto Tecnológico Superior de Cosamaloapan',
    area: 'Subdirección Académica',
    formato: 'Reporte parcial del semestre',
    version: 2,
    carrera: {
      id: 3,
      nombre: 'Ingeniería en Sistemas Computacionales',
      codigo: 'ISC',
    },
    docente: { id: 8, nombre: 'Laura Pérez' },
    jefeDivision: { id: 2, nombre: 'María Hernández' },
    periodo: '2026-B',
    periodoTexto: 'AGOSTO - DICIEMBRE 2026',
    intervalo: { desde: '2026-08-31', hasta: '2026-10-24' },
    generadoEn: new Date('2026-10-24T12:00:00Z'),
    gruposAtendidos: 1,
    asignaturasDiferentes: 1,
    filas: [fila],
    totales: {
      ...fila,
      materia: undefined,
      unidad: undefined,
      semestre: undefined,
      grupo: undefined,
    },
    notas: [
      'A = alumnos inscritos.',
      'Una lista sin captura no clasifica deserción.',
    ],
  };
}

describe('ReporteParcialService exportación', () => {
  it('genera el Excel con el formato institucional Reporte 1 del SGI', async () => {
    const service = crear();
    jest.spyOn(service, 'reporte').mockResolvedValue(muestra() as never);

    const archivo = await service.exportar(
      { id: 8, nombre: 'Laura Pérez', rol: 'DOCENTE' },
      { carreraId: 3 },
      'excel',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(archivo.buffer as never);
    const hoja = workbook.getWorksheet('Reporte parcial') as ExcelJS.Worksheet;

    expect(archivo.filename).toBe('reporte-parcial-laura-perez-2026-b.xlsx');
    expect(hoja.getImages()).toHaveLength(2);
    expect(hoja.getCell('B3').value).toBe(
      'Nombre del Formato: Reporte Parcial del Semestre del SGI del G3',
    );
    expect(hoja.getCell('B13').value).toBe('31 de agosto');
    expect(hoja.getCell('L13').value).toBe('24 de octubre');
    expect(hoja.getCell('C14').value).toBe('LAURA PÉREZ');
    // Primera fila de la tabla en la 20, como la plantilla.
    expect(hoja.getCell('A20').value).toBe('REDES DE COMPUTADORAS');
    expect(hoja.getCell('C20').value).toBe('V');
    expect(hoja.getCell('D20').value).toBe('503-A');
    expect(hoja.getCell('F20').value).toBe(15);
    expect(hoja.getCell('H20').value).toBe(12);
    expect(hoja.getCell('J20').value).toBe(1);
    expect(hoja.getCell('L20').value).toMatchObject({
      formula: 'IF(F20=0,0,(H20+J20)/F20)',
    });
    // Ocho renglones mínimos: el total queda en la 28 y las firmas en la 42.
    expect(hoja.getCell('A28').value).toBe('TOTAL');
    expect(hoja.getCell('F28').value).toMatchObject({
      formula: 'SUM(F20:F27)',
      result: 15,
    });
    expect(hoja.getCell('A42').value).toBe('LAURA PÉREZ');
    expect(hoja.getCell('I42').value).toBe('MARÍA HERNÁNDEZ');
    expect(hoja.getCell('T46').value).toBe('Rev. 1');
  });

  it('agrega renglones cuando hay más de ocho asignaturas y recorre el pie', async () => {
    const service = crear();
    const base = muestra();
    const filas = Array.from({ length: 10 }, (_, i) => ({
      ...base.filas[0],
      grupo: { id: i, nombre: `50${i}-A` },
    }));
    jest
      .spyOn(service, 'reporte')
      .mockResolvedValue({ ...base, filas } as never);

    const archivo = await service.exportar(
      { id: 8, nombre: 'Laura Pérez', rol: 'DOCENTE' },
      { carreraId: 3 },
      'excel',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(archivo.buffer as never);
    const hoja = workbook.getWorksheet('Reporte parcial') as ExcelJS.Worksheet;

    expect(hoja.getCell('D29').value).toBe('509-A');
    expect(hoja.getCell('A30').value).toBe('TOTAL');
    expect(hoja.getCell('F30').value).toMatchObject({
      formula: 'SUM(F20:F29)',
    });
    expect(hoja.getCell('I44').value).toBe('MARÍA HERNÁNDEZ');
    expect(hoja.pageSetup.fitToPage).toBe(true);
  });

  it('genera un PDF válido con el mismo reporte', async () => {
    const service = crear();
    jest.spyOn(service, 'reporte').mockResolvedValue(muestra() as never);

    const archivo = await service.exportar(
      { id: 8, nombre: 'Laura Pérez', rol: 'DOCENTE' },
      { carreraId: 3 },
      'pdf',
    );

    expect(archivo.filename).toBe('reporte-parcial-laura-perez-2026-b.pdf');
    expect(archivo.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(archivo.buffer.length).toBeGreaterThan(1000);
  });
});
