import { getCurrentAcademicPeriod } from '../common/periodo.util';
import {
  coberturaSemanal,
  coincidenHorarios,
  estadoCaptura,
  filtroGrupoVigente,
  horasSemanal,
  grupoPerteneceAPeriodo,
  periodoCanonicoDeGrupo,
  periodoSupervision,
  resumenCierre,
  riesgoDeGrupo,
} from './supervision.utils';

const base = {
  suspendida: false,
  futura: false,
  alumnos: 20,
  registros: 0,
  activa: false,
  tardia: false,
};

describe('supervision.utils', () => {
  it('una suspensión manda sobre cualquier captura', () => {
    expect(estadoCaptura({ ...base, suspendida: true, registros: 20 })).toBe(
      'SUSPENDIDA',
    );
  });

  it('una clase futura solo está programada, sin inventar cumplimiento', () => {
    expect(estadoCaptura({ ...base, futura: true })).toBe('PROGRAMADA');
  });

  it('distingue completa, tardía, parcial, en curso y sin captura', () => {
    expect(estadoCaptura({ ...base, registros: 20 })).toBe('LISTA_COMPLETA');
    expect(estadoCaptura({ ...base, registros: 20, tardia: true })).toBe(
      'REGISTRO_TARDIO',
    );
    expect(estadoCaptura({ ...base, registros: 5 })).toBe('CAPTURA_PARCIAL');
    expect(estadoCaptura({ ...base, activa: true })).toBe('REGISTRO_EN_CURSO');
    expect(estadoCaptura(base)).toBe('SIN_CAPTURA');
  });

  it('sin inscritos no se espera lista', () => {
    expect(estadoCaptura({ ...base, alumnos: 0 })).toBe('SIN_ALUMNOS');
  });

  it('las horas semanales usan duración por número de días', () => {
    expect(
      horasSemanal({
        dias: 'LUNES,MIERCOLES,VIERNES',
        horaInicio: '07:00',
        horaFin: '08:30',
      }),
    ).toBe(4.5);
  });

  it('detecta choques solo si coinciden día y hora', () => {
    const a = { dias: 'LUNES,MARTES', horaInicio: '08:00', horaFin: '10:00' };
    expect(
      coincidenHorarios(a, {
        dias: 'MARTES',
        horaInicio: '09:00',
        horaFin: '11:00',
      }),
    ).toBe(true);
    expect(
      coincidenHorarios(a, {
        dias: 'MARTES',
        horaInicio: '10:00',
        horaFin: '11:00',
      }),
    ).toBe(false);
    expect(
      coincidenHorarios(a, {
        dias: 'JUEVES',
        horaInicio: '08:00',
        horaFin: '10:00',
      }),
    ).toBe(false);
  });

  it('valida el periodo explícito', () => {
    expect(periodoSupervision('2026-b')).toBe('2026-B');
    expect(() => periodoSupervision('2026-2027')).toThrow();
  });

  it('reconoce como el mismo ciclo las etiquetas libres de la institución', () => {
    expect(periodoCanonicoDeGrupo('Agosto-Diciembre 2026')).toBe('2026-B');
    expect(periodoCanonicoDeGrupo('Ago–Dic 2026')).toBe('2026-B');
    expect(periodoCanonicoDeGrupo('ENERO - JUNIO 2026')).toBe('2026-A');
    expect(
      grupoPerteneceAPeriodo(
        {
          periodo: 'agosto-diciembre',
          createdAt: new Date('2026-08-10T12:00:00Z'),
        },
        '2026-B',
      ),
    ).toBe(true);
  });

  it('no adivina un ciclo cuando sólo recibe un intervalo de años', () => {
    expect(periodoCanonicoDeGrupo('2026-2027')).toBeNull();
  });

  it('resume el concentrado de un curso cerrado con la regla NA', () => {
    const cierre = resumenCierre({
      cerradoEn: new Date('2026-12-11T18:00:00Z'),
      concentrado: {
        docente: 'Laura Méndez',
        alumnos: [
          { alumno: { id: 1 }, estado: 'ACREDITADO', final: 90 },
          { alumno: { id: 2 }, estado: 'ACREDITADO', final: 75 },
          { alumno: { id: 3 }, estado: 'NO_ACREDITADO', final: null },
        ],
      },
    });
    expect(cierre).toMatchObject({
      docente: 'Laura Méndez',
      total: 3,
      acreditados: 2,
      noAcreditados: 1,
      pendientes: 0,
      promedio: 82.5,
    });
    expect(resumenCierre(null)).toBeNull();
  });
});

describe('filtroGrupoVigente', () => {
  it('en el periodo actual solo cuenta grupos activos; en uno anterior, también los dados de baja', () => {
    expect(filtroGrupoVigente(getCurrentAcademicPeriod())).toEqual({
      activo: true,
    });
    expect(filtroGrupoVigente('2020-A')).toEqual({});
  });
});

describe('coberturaSemanal', () => {
  const clase = (
    fecha: string,
    estado: string,
    elegible = true,
    docenteId = 4,
    modalidad = 'ESCOLARIZADO',
  ) => ({
    fecha,
    estado,
    elegible,
    docente: { id: docenteId },
    grupo: { modalidad },
  });

  it('agrupa por lunes, docente y modalidad con la regla de los indicadores', () => {
    const { semanas, filas } = coberturaSemanal(
      [
        clase('2026-10-12', 'LISTA_COMPLETA'),
        clase('2026-10-13', 'REGISTRO_TARDIO'),
        clase('2026-10-14', 'SIN_CAPTURA'),
        clase('2026-10-15', 'CAPTURA_PARCIAL'),
        clase('2026-10-16', 'SUSPENDIDA', false),
        clase('2026-10-17', 'LISTA_COMPLETA', true, 9, 'MIXTO'),
        // Una clase que todavía no concluye no cuenta.
        clase('2026-10-19', 'PROGRAMADA', false),
      ],
      '2026-10-08',
      '2026-10-20',
    );
    expect(semanas).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(filas).toEqual([
      {
        lunes: '2026-10-12',
        docenteId: 4,
        modalidad: 'ESCOLARIZADO',
        esperadas: 4,
        completas: 2,
        tardias: 1,
        parciales: 1,
        sinCaptura: 1,
        suspendidas: 1,
      },
      expect.objectContaining({
        lunes: '2026-10-12',
        docenteId: 9,
        modalidad: 'MIXTO',
        esperadas: 1,
        completas: 1,
      }),
    ]);
  });
});

describe('riesgoDeGrupo', () => {
  const fila = (id: number) => ({ alumno: { id } });
  const reportes = [
    { grupo: { id: 1 }, rows: [fila(1), fila(1), fila(2), fila(3)] },
    { grupo: { id: 1 }, rows: [fila(1), fila(4)] },
    { grupo: { id: 2 }, rows: [fila(9)] },
  ];
  const causa = (grupo: number, motivos: string[]) => ({
    grupo: { id: grupo },
    motivos,
  });

  it('cuenta alumnos únicos y cada motivo sin sumar repetidos', () => {
    const riesgos = [
      {
        id: 1,
        causas: [
          causa(1, ['CALIFICACION_BAJA', 'ASISTENCIA']),
          causa(1, ['ENTREGAS']),
        ],
      },
      { id: 2, causas: [causa(1, ['CALIFICACION_LIMITE'])] },
      // Solo tiene riesgo en otro grupo.
      { id: 9, causas: [causa(2, ['ASISTENCIA'])] },
    ];
    expect(riesgoDeGrupo(1, reportes, riesgos)).toEqual({
      alumnosEvaluados: 4,
      alumnosRiesgo: 2,
      riesgoPorMotivo: {
        reprobando: 1,
        calificacion: 2,
        asistencia: 1,
        entregas: 1,
      },
    });
  });
});
