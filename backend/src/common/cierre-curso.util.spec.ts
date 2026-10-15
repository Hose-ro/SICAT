import {
  estadoUnidad,
  nivelDesempeno,
  resultadoCurso,
  type UnidadCierre,
} from './cierre-curso.util';

const unidad = (
  primera: number | null,
  segunda: number | null = null,
  noPresento = false,
): UnidadCierre => estadoUnidad({ primera, segunda, noPresento });

describe('estadoUnidad', () => {
  it('con 70 o más en primera oportunidad la unidad se alcanza', () => {
    expect(unidad(70)).toEqual({
      estado: 'ALCANZADA',
      calificacion: 70,
      oportunidad: 1,
    });
  });

  it('abajo de 70 queda pendiente de segunda oportunidad', () => {
    expect(unidad(69.9)).toEqual({
      estado: 'PENDIENTE_SEGUNDA',
      calificacion: 69.9,
      oportunidad: 1,
    });
  });

  it('la segunda oportunidad decide y su calificación es la que cuenta', () => {
    expect(unidad(55, 80)).toEqual({
      estado: 'ALCANZADA_SEGUNDA',
      calificacion: 80,
      oportunidad: 2,
    });
    expect(unidad(55, 60).estado).toBe('NO_ALCANZADA');
  });

  it('no presentarse a la segunda deja la unidad no alcanzada', () => {
    expect(unidad(40, null, true)).toEqual({
      estado: 'NO_ALCANZADA',
      calificacion: null,
      oportunidad: 2,
    });
  });

  it('una segunda oportunidad no cambia una unidad ya alcanzada', () => {
    expect(unidad(90, 50).estado).toBe('ALCANZADA');
  });

  it('sin calificación de primera oportunidad no hay estado', () => {
    expect(unidad(null).estado).toBe('SIN_CALIFICAR');
  });
});

describe('resultadoCurso', () => {
  it('con todas alcanzadas, el final es el promedio redondeado', () => {
    expect(resultadoCurso([unidad(90), unidad(55, 75), unidad(84)])).toEqual({
      estado: 'ACREDITADO',
      final: 83,
      nivel: 'BUENO',
    });
  });

  it('con alguna no alcanzada el curso es NA', () => {
    expect(resultadoCurso([unidad(100), unidad(50, 60)])).toEqual({
      estado: 'NO_ACREDITADO',
      final: null,
      nivel: 'INSUFICIENTE',
    });
  });

  it('mientras falte calificar o una segunda oportunidad, está pendiente', () => {
    expect(resultadoCurso([unidad(90), unidad(null)]).estado).toBe('PENDIENTE');
    expect(resultadoCurso([unidad(90), unidad(65)]).estado).toBe('PENDIENTE');
    expect(resultadoCurso([]).estado).toBe('PENDIENTE');
  });
});

describe('nivelDesempeno', () => {
  it.each([
    [100, 'EXCELENTE'],
    [95, 'EXCELENTE'],
    [94, 'NOTABLE'],
    [85, 'NOTABLE'],
    [84, 'BUENO'],
    [75, 'BUENO'],
    [74, 'SUFICIENTE'],
    [70, 'SUFICIENTE'],
    [69, 'INSUFICIENTE'],
  ])('%i es %s', (final, nivel) => {
    expect(nivelDesempeno(final)).toBe(nivel);
  });
});
