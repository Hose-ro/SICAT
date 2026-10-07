import {
  coincidenHorarios,
  estadoCaptura,
  horasSemanal,
  periodoSupervision,
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
});
