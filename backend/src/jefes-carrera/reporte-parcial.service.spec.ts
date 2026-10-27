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
  it('genera un Excel institucional con logotipos y los mismos totales de la vista', async () => {
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
    expect(hoja.getCell('A18').value).toBe('Redes de computadoras');
    expect(hoja.getCell('E18').value).toBe(15);
    expect(hoja.getCell('G18').value).toBe(12);
    expect(hoja.getCell('I18').value).toBe(1);
    expect(hoja.getCell('M28').value).toBe('MARÍA HERNÁNDEZ');
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
