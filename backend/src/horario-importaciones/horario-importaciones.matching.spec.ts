import {
  encontrarDocente,
  encontrarMateria,
  normalizarTexto,
  similitudTexto,
} from './horario-importaciones.matching';

describe('coincidencia de horarios importados', () => {
  const materias = [
    { id: 1, clave: 'RSB-2403', nombre: 'Programación Móvil' },
    { id: 2, clave: 'SCC-1019', nombre: 'Programación Lógica y Funcional' },
  ];

  it('normaliza acentos y signos', () => {
    expect(normalizarTexto('  Programación Móvil ')).toBe('programacion movil');
  });

  it('prioriza una clave aunque el nombre esté abreviado', () => {
    expect(encontrarMateria('RSB 2403', 'PROG. MOV.', materias)).toEqual({
      candidato: materias[0],
      confianza: 1,
    });
  });

  it('encuentra nombres de materia abreviados suficientemente cercanos', () => {
    const resultado = encontrarMateria(
      '',
      'Programacion logica y funcional',
      materias,
    );
    expect(resultado.candidato?.id).toBe(2);
    expect(resultado.confianza).toBeGreaterThan(0.9);
  });

  it('no asigna automáticamente un docente con baja similitud', () => {
    const resultado = encontrarDocente('Francisco', [
      { id: 7, nombre: 'Roberto Martínez Galán' },
    ]);
    expect(resultado.candidato).toBeNull();
  });

  it('tolera acentos al comparar docentes', () => {
    expect(similitudTexto('Hector Marquez', 'Héctor Márquez')).toBe(1);
  });
});
