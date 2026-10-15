import {
  estadoTema,
  resumirAvance,
  semanaDelCurso,
  semanasDelCurso,
} from './temario.util';

const inicio = new Date(2026, 7, 31); // lunes 31 ago
const fin = new Date(2026, 11, 18); // viernes 18 dic

describe('semanaDelCurso', () => {
  it('cuenta semanas desde el inicio del periodo', () => {
    expect(semanaDelCurso(inicio, fin, new Date(2026, 7, 31))).toBe(1);
    expect(semanaDelCurso(inicio, fin, new Date(2026, 8, 6))).toBe(1);
    expect(semanaDelCurso(inicio, fin, new Date(2026, 8, 7))).toBe(2);
    expect(semanaDelCurso(inicio, fin, new Date(2026, 9, 15))).toBe(7);
  });

  it('antes del inicio es 0 y después del fin, la última', () => {
    expect(semanaDelCurso(inicio, fin, new Date(2026, 7, 1))).toBe(0);
    expect(semanaDelCurso(inicio, fin, new Date(2027, 0, 10))).toBe(
      semanasDelCurso(inicio, fin),
    );
    expect(semanasDelCurso(inicio, fin)).toBe(16);
  });
});

describe('estadoTema', () => {
  it('visto gana; sin ver y con semana pasada está atrasado', () => {
    expect(estadoTema({ semana: 2 }, new Date(), 7)).toBe('VISTO');
    expect(estadoTema({ semana: 6 }, null, 7)).toBe('ATRASADO');
    expect(estadoTema({ semana: 7 }, null, 7)).toBe('PENDIENTE');
    expect(estadoTema({ semana: null }, null, 7)).toBe('PENDIENTE');
  });
});

describe('resumirAvance', () => {
  it('cuenta vistos, planeados a la fecha y atrasados', () => {
    expect(
      resumirAvance(
        [
          { semana: 1, estado: 'VISTO' },
          { semana: 2, estado: 'ATRASADO' },
          { semana: 7, estado: 'PENDIENTE' },
          { semana: null, estado: 'VISTO' },
        ],
        7,
      ),
    ).toEqual({
      total: 4,
      vistos: 2,
      porcentaje: 50,
      planeadosALaFecha: 3,
      atrasados: 1,
    });
  });
});
