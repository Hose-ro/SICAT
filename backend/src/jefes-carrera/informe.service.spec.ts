import { PrismaService } from '../prisma.service';
import { InformeService } from './informe.service';
import { SupervisionService } from './supervision.service';
import { SeguimientosService } from './seguimientos.service';

const calendarios = [
  {
    modalidad: 'ESCOLARIZADO',
    configurado: true,
    inicio: new Date(2026, 7, 24),
    fin: new Date(2026, 11, 11, 23, 59),
  },
  {
    modalidad: 'MIXTO',
    configurado: true,
    inicio: new Date(2026, 7, 29),
    fin: new Date(2026, 11, 12, 23, 59),
  },
];

function clase(docenteId: number, estado: string, elegible = true) {
  return {
    fecha: '2026-10-12',
    horaInicio: '07:00',
    horaFin: '09:00',
    elegible,
    estado,
    registros: estado === 'CAPTURA_PARCIAL' ? 10 : 0,
    alumnos: 20,
    materia: { nombre: 'Cálculo diferencial' },
    grupo: { nombre: '1A' },
    docente: { id: docenteId, nombre: docenteId === 1 ? 'Laura' : 'Carlos' },
  };
}

function crear() {
  const supervision = {
    resumen: jest.fn().mockResolvedValue({
      calendarios,
      docentes: [
        { id: 2, nombre: 'Carlos', horasSemanales: 8 },
        { id: 1, nombre: 'Laura', horasSemanales: 10 },
      ],
      ofertas: [],
      riesgos: [
        {
          id: 5,
          nombre: 'Ana',
          numeroControl: '221100',
          sexo: 'MUJER',
          causas: [
            {
              materia: { nombre: 'Cálculo' },
              grupo: { nombre: '1A' },
              motivos: ['ASISTENCIA', 'CALIFICACION_BAJA'],
            },
          ],
        },
      ],
      indicadores: { calificacionesPendientes: 3 },
    }),
    clases: jest
      .fn()
      .mockResolvedValue([
        clase(1, 'LISTA_COMPLETA'),
        clase(1, 'SIN_CAPTURA'),
        clase(1, 'REGISTRO_TARDIO'),
        clase(2, 'CAPTURA_PARCIAL'),
        clase(2, 'PROGRAMADA', false),
      ]),
  };
  const prisma = {
    carrera: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 3, nombre: 'Sistemas', codigo: 'ISC' }),
    },
  };
  const seguimientos = { notasEnRango: jest.fn().mockResolvedValue([]) };
  const service = new InformeService(
    prisma as unknown as PrismaService,
    supervision as unknown as SupervisionService,
    seguimientos as unknown as SeguimientosService,
  );
  return { service, supervision };
}

describe('InformeService', () => {
  const consulta = {
    carreraId: 3,
    periodo: '2026-B',
    desde: '2026-10-01',
    hasta: '2026-10-15',
  };

  it('calcula la cobertura por docente solo con clases elegibles', async () => {
    const { service } = crear();
    const informe = await service.informe(9, consulta);
    expect(
      informe.docentes.map((d) => [d.nombre, d.esperadas, d.cobertura]),
    ).toEqual([
      ['Carlos', 1, 0],
      ['Laura', 3, 67],
    ]);
    expect(informe.totales).toMatchObject({
      clasesEsperadas: 4,
      listasCompletas: 2,
      listasPendientes: 2,
      cobertura: 50,
      alumnosRiesgo: 1,
      calificacionesPendientes: 3,
    });
    expect(informe.riesgos[0].motivos).toEqual([
      'Faltas y retardos ≥ 30 %',
      'Calificación reprobatoria',
    ]);
  });

  it('rechaza un intervalo fuera del periodo', async () => {
    const { service } = crear();
    await expect(
      service.informe(9, { ...consulta, desde: '2026-07-01' }),
    ).rejects.toThrow('El intervalo debe quedar dentro del periodo');
  });

  it('rechaza un intervalo invertido', async () => {
    const { service } = crear();
    await expect(
      service.informe(9, { ...consulta, desde: '2026-10-20' }),
    ).rejects.toThrow('La fecha final debe ser igual o posterior a la inicial');
  });

  it('exporta Excel y PDF con un nombre que identifica carrera, periodo e intervalo', async () => {
    const { service } = crear();
    const excel = await service.exportar(9, consulta, 'excel');
    expect(excel.filename).toBe('SICAT_ISC_2026-B_2026-10-01_2026-10-15.xlsx');
    expect(excel.buffer.length).toBeGreaterThan(1000);
    const pdf = await service.exportar(9, consulta, 'pdf');
    expect(pdf.filename).toBe('SICAT_ISC_2026-B_2026-10-01_2026-10-15.pdf');
    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
