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

    expect(String(sheet.getCell('D3').value)).toContain('Sin clases');
    expect(sheet.getCell('D4').value).toBe('SC');
    expect(sheet.getCell('F4').value).toBe(0);
    expect(sheet.getCell('B7').value).toBe('Motivo');
    expect(sheet.getCell('B8').value).toBe('Día festivo');
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

    expect(sheet.getCell('C2').value).toBe('Sexo');
    expect(sheet.getCell('C3').value).toBe('M');
    expect(sheet.getCell('C4').value).toBe('');
  });

  it('agrega la columna Sexo al CSV de calificaciones', async () => {
    const csv = (
      await service.generarCsvCalificacionesCaptura({
        rows: [
          {
            alumno: { nombre: 'Beto', numeroControl: '456', sexo: 'HOMBRE' },
            calificacionFinal: 90,
            unidad: { nombre: 'Unidad 1' },
            estado: 'APROBADO',
          },
        ],
      })
    ).toString('utf8');

    expect(csv).toContain('No. control,Alumno,Sexo,Calificacion');
    expect(csv).toContain('456,Beto,H,90');
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
