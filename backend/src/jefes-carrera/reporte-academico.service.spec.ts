import * as ExcelJS from 'exceljs';
import { ReporteAcademicoService } from './reporte-academico.service';
import { SupervisionService } from './supervision.service';
import { PrismaService } from '../prisma.service';
const unidades = [
  { id: 1, orden: 1, nombre: 'Unidad 1', status: 'FINALIZADA' },
  { id: 2, orden: 2, nombre: 'Unidad 2', status: 'ACTIVA' },
  { id: 3, orden: 3, nombre: 'Unidad 3', status: 'PENDIENTE' },
];
const alumno = { id: 10, nombre: 'Ana', numeroControl: '2210', sexo: 'MUJER' };
const row = (
  i: number,
  calificacion: number | null,
  registradas = 0,
  asistencias = 0,
) => ({
  alumno,
  unidad: unidades[i],
  calificacionFinal: calificacion,
  calificacionManual: null,
  asistencia: { registradas, asistencias },
});
const fuente = {
  generatedAt: '2026-11-04T15:00:00Z',
  periodo: '2026-B',
  grupo: { id: 8, nombre: '1A' },
  materia: { nombre: 'Cálculo', clave: 'CAL1' },
  unidades,
  rows: [row(0, 0, 10, 8), row(1, 80, 2, 1), row(2, null)],
};
const consulta = {
  carreraId: 1,
  periodo: '2026-B',
  materiaId: 411,
  grupoId: 8,
};
function crear() {
  const supervision = { reporte: jest.fn().mockResolvedValue(fuente) };
  const prisma = {
    carrera: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 1, codigo: 'ISC', nombre: 'Sistemas' }),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Jefa de carrera' }),
    },
  };
  return {
    service: new ReporteAcademicoService(
      supervision as unknown as SupervisionService,
      prisma as unknown as PrismaService,
    ),
    supervision,
    prisma,
  };
}
describe('reporte académico de jefatura', () => {
  it('comparte el alcance autorizado y consulta al corte actual', async () => {
    const { service, supervision } = crear();
    await service.reporte(9, consulta);
    expect(supervision.reporte).toHaveBeenCalledWith(9, consulta, 411, 8, true);
    supervision.reporte.mockRejectedValueOnce(
      new Error('Carrera fuera de tu alcance'),
    );
    await expect(service.reporte(9, consulta)).rejects.toThrow(
      'Carrera fuera de tu alcance',
    );
  });
  it('conserva cero, excluye unidades futuras sin actividad y pondera asistencia por registros', async () => {
    const { service } = crear();
    const r = await service.reporte(9, consulta);
    expect(r.unidades.map((u) => u.id)).toEqual([1, 2]);
    expect(r.filas[0]).toMatchObject({
      promedio: 40,
      provisional: true,
      pendientes: 0,
      asistencia: { registradas: 12, asistencias: 9, porcentaje: 75 },
    });
    expect(r.avance).toMatchObject({ total: 3, cerradas: 1, porcentaje: 33 });
  });
  it('acota a una unidad y mantiene sin captura y sin registros distintos de cero', async () => {
    const { service } = crear();
    const r = await service.reporte(9, { ...consulta, unidadId: 3 });
    expect(r.filas[0]).toMatchObject({
      promedio: null,
      pendientes: 1,
      asistencia: { porcentaje: null },
    });
    expect(r.unidades).toHaveLength(1);
    await expect(
      service.reporte(9, { ...consulta, unidadId: 999 }),
    ).rejects.toThrow('La unidad no pertenece');
  });
  it('genera Excel institucional con sexo, calificaciones, asistencia y avance', async () => {
    const { service } = crear();
    const archivo = await service.exportar(9, consulta, 'excel');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(archivo.buffer as unknown as ExcelJS.Buffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual([
      'Resumen',
      'Calificaciones',
      'Avance de unidades',
    ]);
    expect(JSON.stringify(libro.getWorksheet('Resumen')!.model)).toContain(
      'INSTITUTO TECNOLÓGICO',
    );
    expect(libro.getWorksheet('Calificaciones')!.getRow(2).values).toContain(
      'M',
    );
    expect(archivo.filename).toContain('acumulado.xlsx');
  });
  it('mantiene distintas las unidades heredadas que todavía no tienen ID', async () => {
    const { service, supervision } = crear();
    const heredadas = unidades
      .slice(0, 2)
      .map((u) => ({ ...u, id: null, status: null }));
    supervision.reporte.mockResolvedValueOnce({
      ...fuente,
      unidades: heredadas,
      rows: heredadas.map((u, i) => ({ ...row(i, 50 + i * 50), unidad: u })),
    });
    const reporte = await service.reporte(9, consulta);
    expect(reporte.filas[0].notas.map((n) => n.calificacion)).toEqual([
      50, 100,
    ]);
    expect(reporte.filas[0].promedio).toBe(75);
  });
  it('genera PDF institucional por unidad sin notas de otras unidades', async () => {
    const { service } = crear();
    const pdf = await service.exportar(9, { ...consulta, unidadId: 2 }, 'pdf');
    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.filename).toContain('U2.pdf');
  });
});
