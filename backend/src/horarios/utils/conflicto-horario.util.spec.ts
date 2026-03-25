import { hayConflictoHorario } from './conflicto-horario.util';

describe('hayConflictoHorario', () => {
  it('dos materias en días diferentes → sin conflicto', () => {
    const a = {
      dias: 'Lunes,Miercoles',
      horaInicio: '07:00',
      horaFin: '09:00',
    };
    const b = { dias: 'Martes,Jueves', horaInicio: '07:00', horaFin: '09:00' };
    expect(hayConflictoHorario(a, b)).toBe(false);
  });

  it('mismo día, horas que no se traslapan → sin conflicto', () => {
    const a = { dias: 'Lunes', horaInicio: '07:00', horaFin: '09:00' };
    const b = { dias: 'Lunes', horaInicio: '10:00', horaFin: '12:00' };
    expect(hayConflictoHorario(a, b)).toBe(false);
  });

  it('mismo día, una materia dentro de la otra → conflicto', () => {
    const a = { dias: 'Lunes', horaInicio: '07:00', horaFin: '12:00' };
    const b = { dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' };
    expect(hayConflictoHorario(a, b)).toBe(true);
  });

  it('mismo día, traslape parcial → conflicto', () => {
    const a = { dias: 'Lunes', horaInicio: '07:00', horaFin: '09:00' };
    const b = { dias: 'Lunes', horaInicio: '08:00', horaFin: '10:00' };
    expect(hayConflictoHorario(a, b)).toBe(true);
  });

  it('un día en común de varios → conflicto', () => {
    const a = {
      dias: 'Lunes,Miercoles,Viernes',
      horaInicio: '07:00',
      horaFin: '09:00',
    };
    const b = {
      dias: 'Miercoles,Jueves',
      horaInicio: '08:00',
      horaFin: '10:00',
    };
    expect(hayConflictoHorario(a, b)).toBe(true);
  });

  it('materias consecutivas (una termina cuando otra empieza) → sin conflicto', () => {
    const a = { dias: 'Lunes', horaInicio: '07:00', horaFin: '09:00' };
    const b = { dias: 'Lunes', horaInicio: '09:00', horaFin: '11:00' };
    expect(hayConflictoHorario(a, b)).toBe(false);
  });

  it('días con espacios extra → normaliza correctamente', () => {
    const a = {
      dias: 'Lunes, Miercoles',
      horaInicio: '07:00',
      horaFin: '09:00',
    };
    const b = {
      dias: 'Miercoles ,Viernes',
      horaInicio: '07:30',
      horaFin: '09:30',
    };
    expect(hayConflictoHorario(a, b)).toBe(true);
  });
});
