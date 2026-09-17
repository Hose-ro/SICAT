import {
  formatearHoraEnZona,
  instanteEnZona,
  rangoDiaEnZona,
  resolverFechaHoraLimite,
} from './zona-horaria.util';

// Estas pruebas no dependen de la TZ del proceso: la zona se pasa explícita y
// todo se compara como instantes UTC.
describe('zona-horaria.util', () => {
  const MX = 'America/Mexico_City'; // UTC-6 fijo desde 2022

  it('convierte hora de pared del plantel a instante', () => {
    expect(
      instanteEnZona(
        { year: 2026, month: 9, day: 20, hour: 23, minute: 59 },
        MX,
      ).toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
  });

  it('respeta el horario de verano en zonas que lo tienen', () => {
    const NY = 'America/New_York';
    expect(
      instanteEnZona(
        { year: 2026, month: 1, day: 15, hour: 12, minute: 0 },
        NY,
      ).toISOString(),
    ).toBe('2026-01-15T17:00:00.000Z');
    expect(
      instanteEnZona(
        { year: 2026, month: 7, day: 15, hour: 12, minute: 0 },
        NY,
      ).toISOString(),
    ).toBe('2026-07-15T16:00:00.000Z');
  });

  it('la fecha límite del formulario (sin desplazamiento) vence a la hora local del plantel', () => {
    expect(
      resolverFechaHoraLimite('2026-09-20T23:59', '23:59', MX)?.toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
    expect(
      resolverFechaHoraLimite('2026-09-20T23:59', undefined, MX)?.toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
    expect(
      resolverFechaHoraLimite('2026-09-20', undefined, MX)?.toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
    expect(
      resolverFechaHoraLimite('2026-09-20', '08:30', MX)?.toISOString(),
    ).toBe('2026-09-20T14:30:00.000Z');
  });

  it('un ISO con desplazamiento ya es un instante; la hora explícita se aplica sobre su día local', () => {
    expect(
      resolverFechaHoraLimite(
        '2026-09-21T05:59:00.000Z',
        undefined,
        MX,
      )?.toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
    // 05:59Z es el 20 de septiembre a las 23:59 en México: cambiar la hora a 10:00 debe quedarse en el día 20.
    expect(
      resolverFechaHoraLimite(
        '2026-09-21T05:59:00.000Z',
        '10:00',
        MX,
      )?.toISOString(),
    ).toBe('2026-09-20T16:00:00.000Z');
    expect(resolverFechaHoraLimite('no-es-fecha', undefined, MX)).toBeNull();
  });

  it('formatea la hora de pared y el rango del día en la zona del plantel', () => {
    expect(formatearHoraEnZona(new Date('2026-09-21T05:59:00.000Z'), MX)).toBe(
      '23:59',
    );
    expect(formatearHoraEnZona(null, MX)).toBeNull();
    const rango = rangoDiaEnZona('2026-09-20', MX);
    expect(rango?.inicio.toISOString()).toBe('2026-09-20T06:00:00.000Z');
    expect(rango?.fin.toISOString()).toBe('2026-09-21T05:59:59.999Z');
    expect(rangoDiaEnZona('20/09/2026', MX)).toBeNull();
  });
});
