import { evaluarDesempeno } from './desempeno.util';

const sinFaltas = { registradas: 10, faltas: 0, retardos: 0 };
const conFaltas = { registradas: 10, faltas: 2, retardos: 1 };
const abierta = (calificacion: number | null, asistencia = sinFaltas) =>
  evaluarDesempeno({ calificacion, unidadFinalizada: false, asistencia });
const cerrada = (calificacion: number | null, asistencia = sinFaltas) =>
  evaluarDesempeno({ calificacion, unidadFinalizada: true, asistencia });

describe('evaluarDesempeno', () => {
  it('en una unidad abierta: verde desde 80, amarillo de 70 a 79 y rojo debajo de 70', () => {
    expect(abierta(92)).toEqual({ estado: 'APROBADO', motivos: [] });
    expect(abierta(80)).toEqual({ estado: 'APROBADO', motivos: [] });
    expect(abierta(79)).toEqual({
      estado: 'EN_RIESGO',
      motivos: ['CALIFICACION_LIMITE'],
    });
    expect(abierta(70).estado).toBe('EN_RIESGO');
    expect(abierta(69)).toEqual({
      estado: 'REPROBADO',
      motivos: ['CALIFICACION_BAJA'],
    });
  });

  it('las faltas ponen en riesgo aunque la calificación sea buena o no la haya', () => {
    // 3 de 10 entre faltas y retardos: 30 %.
    expect(abierta(95, conFaltas)).toEqual({
      estado: 'EN_RIESGO',
      motivos: ['ASISTENCIA'],
    });
    expect(abierta(null, conFaltas)).toEqual({
      estado: 'EN_RIESGO',
      motivos: ['ASISTENCIA'],
    });
    expect(abierta(75, conFaltas).motivos).toEqual([
      'CALIFICACION_LIMITE',
      'ASISTENCIA',
    ]);
    // Reprobado sigue siendo rojo, con las faltas como motivo extra.
    expect(abierta(60, conFaltas)).toEqual({
      estado: 'REPROBADO',
      motivos: ['CALIFICACION_BAJA', 'ASISTENCIA'],
    });
    // Con menos de 3 registros todavía no hay riesgo por faltas.
    expect(abierta(90, { registradas: 2, faltas: 2, retardos: 0 }).estado).toBe(
      'APROBADO',
    );
  });

  it('sin calificación y sin faltas queda sin calificar', () => {
    expect(abierta(null)).toEqual({ estado: 'SIN_CALIFICAR', motivos: [] });
  });

  it('una unidad cerrada sólo queda aprobada o reprobada', () => {
    expect(cerrada(75, conFaltas)).toEqual({ estado: 'APROBADO', motivos: [] });
    expect(cerrada(70).estado).toBe('APROBADO');
    expect(cerrada(69).estado).toBe('REPROBADO');
    expect(cerrada(null).estado).toBe('SIN_CALIFICAR');
  });
});
