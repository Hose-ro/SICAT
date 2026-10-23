import {
  evaluarDesempeno,
  faltanEntregas,
  resumirRiesgoFilas,
} from './desempeno.util';

const sinFaltas = { registradas: 10, faltas: 0, retardos: 0 };
const conFaltas = { registradas: 10, faltas: 2, retardos: 1 };
const abierta = (calificacion: number | null, asistencia = sinFaltas) =>
  evaluarDesempeno({ calificacion, unidadFinalizada: false, asistencia });
const cerrada = (calificacion: number | null, asistencia = sinFaltas) =>
  evaluarDesempeno({ calificacion, unidadFinalizada: true, asistencia });

describe('evaluarDesempeno', () => {
  it('aprobado desde 70 y reprobado debajo, sin estado intermedio', () => {
    expect(abierta(92)).toEqual({ estado: 'APROBADO', motivos: [] });
    expect(abierta(79)).toEqual({ estado: 'APROBADO', motivos: [] });
    expect(abierta(70)).toEqual({ estado: 'APROBADO', motivos: [] });
    expect(abierta(69)).toEqual({
      estado: 'REPROBADO',
      motivos: ['CALIFICACION_BAJA'],
    });
  });

  it('las faltas son motivo de riesgo pero no cambian el estado', () => {
    // 3 de 10 entre faltas y retardos: 30 %.
    expect(abierta(95, conFaltas)).toEqual({
      estado: 'APROBADO',
      motivos: ['ASISTENCIA'],
    });
    expect(abierta(null, conFaltas)).toEqual({
      estado: 'SIN_CALIFICAR',
      motivos: ['ASISTENCIA'],
    });
    expect(abierta(60, conFaltas)).toEqual({
      estado: 'REPROBADO',
      motivos: ['CALIFICACION_BAJA', 'ASISTENCIA'],
    });
    // Con menos de 3 registros todavía no hay riesgo por faltas.
    expect(
      abierta(90, { registradas: 2, faltas: 2, retardos: 0 }).motivos,
    ).toEqual([]);
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

  it('las tareas vencidas sin entregar son motivo de riesgo desde 30 % con al menos 2 vencidas', () => {
    const entregas = { vencidas: 5, sinEntregar: 2 };
    expect(
      evaluarDesempeno({
        calificacion: 92,
        unidadFinalizada: false,
        asistencia: sinFaltas,
        entregas,
      }),
    ).toEqual({ estado: 'APROBADO', motivos: ['ENTREGAS'] });
    expect(
      evaluarDesempeno({
        calificacion: 60,
        unidadFinalizada: false,
        asistencia: conFaltas,
        entregas,
      }),
    ).toEqual({
      estado: 'REPROBADO',
      motivos: ['CALIFICACION_BAJA', 'ASISTENCIA', 'ENTREGAS'],
    });
    // La unidad cerrada no cambia por entregas.
    expect(
      evaluarDesempeno({
        calificacion: 85,
        unidadFinalizada: true,
        asistencia: sinFaltas,
        entregas,
      }).estado,
    ).toBe('APROBADO');
  });

  it('con menos de 2 vencidas o menos de 30 % sin entregar no hay riesgo por entregas', () => {
    expect(faltanEntregas({ vencidas: 1, sinEntregar: 1 })).toBe(false);
    expect(faltanEntregas({ vencidas: 10, sinEntregar: 2 })).toBe(false);
    expect(faltanEntregas({ vencidas: 10, sinEntregar: 3 })).toBe(true);
    expect(faltanEntregas(undefined)).toBe(false);
  });
});

describe('resumirRiesgoFilas', () => {
  it('cuenta alumnos únicos con y sin motivos', () => {
    const fila = (id: number, motivos: string[]) => ({
      alumno: { id },
      motivos,
    });
    expect(
      resumirRiesgoFilas([
        fila(1, ['CALIFICACION_BAJA']),
        fila(1, ['ASISTENCIA', 'ENTREGAS']),
        fila(2, ['ENTREGAS']),
        fila(2, []),
        fila(3, []),
      ]),
    ).toEqual({
      evaluados: 3,
      enRiesgo: 2,
      reprobando: 1,
      motivos: { calificacion: 1, asistencia: 1, entregas: 2 },
    });
  });
});
