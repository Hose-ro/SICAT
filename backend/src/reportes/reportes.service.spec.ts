import * as ExcelJS from 'exceljs';
import { ReportesService } from './reportes.service';

describe('ReportesService días sin clases', () => {
  const service = new ReportesService();
  const datos = {
    materia: { nombre: 'Matemáticas', docente: { nombre: 'Docente' } },
    filtros: { fecha: '2026-09-18' },
    sesiones: [
      {
        id: 'suspension-1-12-3',
        fecha: new Date(2026, 8, 18),
        suspensionMotivo: 'Día festivo',
      },
    ],
    alumnos: [{ id: 5, nombre: 'Ana', numeroControl: '123', sexo: 'MUJER' }],
    asistencias: [],
  };

  it('identifica el día en Excel sin sumar faltas al alumno', async () => {
    const buffer = await service.generarExcelAsistencias(datos);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Asistencias') as ExcelJS.Worksheet;

    expect(String(sheet.getCell('D8').value)).toContain('Sin clases');
    expect(sheet.getCell('D9').value).toBe('SC');
    expect(sheet.getCell('F9').value).toBe(0);
    expect(sheet.getCell('B12').value).toBe('Motivo');
    expect(sheet.getCell('B13').value).toBe('Día festivo');
  });

  it('genera un PDF válido con el día suspendido', async () => {
    const buffer = await service.generarPdfAsistencias(datos);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
});

describe('ReportesService sexo del alumno', () => {
  const service = new ReportesService();

  it('lo imprime junto al alumno en el Excel de asistencias', async () => {
    const buffer = await service.generarExcelAsistencias({
      materia: { nombre: 'Matemáticas' },
      sesiones: [],
      alumnos: [
        { id: 1, nombre: 'Ana', numeroControl: '123', sexo: 'MUJER' },
        { id: 2, nombre: 'Beto', numeroControl: '456', sexo: null },
      ],
      asistencias: [],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Asistencias') as ExcelJS.Worksheet;

    expect(sheet.getCell('C7').value).toBe('Sexo');
    expect(sheet.getCell('C8').value).toBe('M');
    expect(sheet.getCell('C9').value).toBe('');
  });

  it('agrega la columna Sexo al Excel de calificaciones', async () => {
    const buffer = await service.generarExcelCalificacionesCaptura({
      rows: [
        {
          alumno: { nombre: 'Beto', numeroControl: '456', sexo: 'HOMBRE' },
          calificacionFinal: 90,
          unidad: { nombre: 'Unidad 1' },
          estado: 'APROBADO',
        },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Captura') as ExcelJS.Worksheet;

    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'No. control',
      'Alumno',
      'Sexo',
      'Calificacion',
      'Unidad',
      'Estado',
    ]);
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      '456',
      'Beto',
      'H',
      90,
      'Unidad 1',
      'Aprobado',
    ]);
  });

  it('genera el PDF de calificaciones aunque falten calificaciones', async () => {
    const buffer = await service.generarPdfCalificacionesCaptura({
      generatedAt: new Date().toISOString(),
      materia: {
        clave: 'MAT-1',
        nombre: 'Cálculo',
        docente: { nombre: 'Eva' },
      },
      rows: [
        {
          alumno: { nombre: 'Beto', numeroControl: '456', sexo: 'HOMBRE' },
          calificacionFinal: 90,
          unidad: { nombre: 'Unidad 1' },
          estado: 'APROBADO',
        },
        { alumno: { nombre: 'Ana', numeroControl: '123' }, estado: null },
      ],
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('agrega la columna Sexo a las hojas de alumnos del reporte de tareas', async () => {
    const buffer = await service.generarExcelReporteTareas({
      generatedAt: new Date(),
      tasks: [{ id: 7, titulo: 'Práctica 1' }],
      students: [
        {
          nombre: 'Ana',
          numeroControl: '123',
          sexo: 'MUJER',
          tasks: [{ tareaId: 7, calificacion: 95 }],
        },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const alumnos = workbook.getWorksheet('Alumnos') as ExcelJS.Worksheet;
    const matriz = workbook.getWorksheet('Matriz') as ExcelJS.Worksheet;

    expect(alumnos.getCell('C1').value).toBe('Sexo');
    expect(alumnos.getCell('C2').value).toBe('M');
    expect(matriz.getCell('C2').value).toBe('M');
    expect(matriz.getCell('D2').value).toBe(95);
  });
});
