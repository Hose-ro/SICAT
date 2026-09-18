import * as ExcelJS from 'exceljs';
import { ReportesService } from './reportes.service';

describe('ReportesService días sin clases', () => {
  const service = new ReportesService();
  const datos = {
    materia: { nombre: 'Matemáticas', docente: { nombre: 'Docente' } },
    filtros: { fecha: '2026-09-18' },
    sesiones: [{
      id: 'suspension-1-12-3',
      fecha: new Date(2026, 8, 18),
      suspensionMotivo: 'Día festivo',
    }],
    alumnos: [{ id: 5, nombre: 'Ana', numeroControl: '123' }],
    asistencias: [],
  };

  it('identifica el día en Excel sin sumar faltas al alumno', async () => {
    const buffer = await service.generarExcelAsistencias(datos);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Asistencias') as ExcelJS.Worksheet;

    expect(String(sheet.getCell('C3').value)).toContain('Sin clases');
    expect(sheet.getCell('C4').value).toBe('SC');
    expect(sheet.getCell('E4').value).toBe(0);
    expect(sheet.getCell('B7').value).toBe('Motivo');
    expect(sheet.getCell('B8').value).toBe('Día festivo');
  });

  it('genera un PDF válido con el día suspendido', async () => {
    const buffer = await service.generarPdfAsistencias(datos);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
