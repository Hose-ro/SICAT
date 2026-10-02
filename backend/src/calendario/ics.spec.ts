import { construirCalendario, diasIcs, escaparTexto, plegarLinea } from './ics';

describe('ics', () => {
  const base = {
    nombre: 'SICAT · Mis clases',
    zona: 'America/Mexico_City',
    desplazamientoMin: -360,
    diasCompletos: [],
    generado: new Date('2026-10-01T12:00:00Z'),
  };

  it('traduce los días del horario, con o sin acentos', () => {
    expect(diasIcs('Miércoles,Lunes, sabado')).toEqual(['MO', 'WE', 'SA']);
    expect(diasIcs('Feriado')).toEqual([]);
  });

  it('escapa texto y pliega a 75 octetos sin partir caracteres', () => {
    expect(escaparTexto('Aula 3, edificio B; piso\n2')).toBe(
      'Aula 3\\, edificio B\\; piso\\n2',
    );
    const linea = `SUMMARY:${'á'.repeat(60)}`;
    const plegada = plegarLinea(linea).split('\r\n');
    expect(plegada.length).toBeGreaterThan(1);
    for (const parte of plegada) {
      expect(Buffer.byteLength(parte, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(plegada.slice(1).every((parte) => parte.startsWith(' '))).toBe(true);
    expect(plegada.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(linea);
  });

  it('arma la clase semanal desde su primer día real, hasta el fin del periodo y sin los días suspendidos', () => {
    const ics = construirCalendario({
      ...base,
      semanales: [
        {
          uid: 'horario-1@sicat',
          resumen: 'Redes · 8A',
          lugar: 'Aula 3',
          // 31 ago 2026 es lunes; la primera clase de miércoles es el 2 sep.
          desde: '2026-08-31',
          hasta: '2026-12-18',
          dias: 'Miercoles,Viernes',
          horaInicio: '08:00',
          horaFin: '09:40',
          // Un lunes (no aplica), un miércoles y otro fuera del rango.
          excepciones: ['2026-10-12', '2026-10-14', '2027-01-06'],
        },
      ],
    });

    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain('DTSTART;TZID=America/Mexico_City:20260902T080000');
    expect(ics).toContain('DTEND;TZID=America/Mexico_City:20260902T094000');
    // 18 dic 23:59:59 en CDMX son las 05:59:59 del 19 en UTC.
    expect(ics).toContain(
      'RRULE:FREQ=WEEKLY;BYDAY=WE,FR;UNTIL=20261219T055959Z',
    );
    expect(ics).toContain('EXDATE;TZID=America/Mexico_City:20261014T080000');
    expect(ics).not.toContain('20261012T080000');
    expect(ics).toContain('TZOFFSETTO:-0600');
    expect(ics).toContain('LOCATION:Aula 3');
  });

  it('las entregas son eventos de día completo', () => {
    const ics = construirCalendario({
      ...base,
      semanales: [],
      diasCompletos: [
        {
          uid: 'tarea-5@sicat',
          resumen: 'Entrega: Práctica 1',
          fecha: '2026-12-31',
        },
      ],
    });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });
});
