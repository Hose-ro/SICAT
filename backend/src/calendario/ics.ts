/**
 * Serializador mínimo de iCalendar (RFC 5545) para la suscripción del horario.
 * Sin dependencias: sólo eventos semanales con excepciones y eventos de día
 * completo, que es todo lo que SICAT publica.
 */

const DIA_ICS: Record<string, string> = {
  domingo: 'SU',
  lunes: 'MO',
  martes: 'TU',
  miercoles: 'WE',
  jueves: 'TH',
  viernes: 'FR',
  sabado: 'SA',
};
const ORDEN_DIAS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export type EventoSemanal = {
  uid: string;
  resumen: string;
  descripcion?: string;
  lugar?: string;
  /** Primer día del rango (AAAA-MM-DD); la primera clase es la primera que cae ahí o después. */
  desde: string;
  /** Último día del rango (AAAA-MM-DD), inclusive. */
  hasta: string;
  /** Días como los guarda el horario: "Lunes,Miércoles". */
  dias: string;
  horaInicio: string;
  horaFin: string;
  /** Días sin clase (AAAA-MM-DD). */
  excepciones: string[];
};

export type EventoDiaCompleto = {
  uid: string;
  resumen: string;
  descripcion?: string;
  fecha: string;
};

export type Calendario = {
  nombre: string;
  zona: string;
  /** Desplazamiento de la zona respecto a UTC, en minutos (México: -360). */
  desplazamientoMin: number;
  semanales: EventoSemanal[];
  diasCompletos: EventoDiaCompleto[];
  generado: Date;
};

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function diasIcs(dias: string) {
  const codigos = new Set(
    dias
      .split(',')
      .map((dia) => DIA_ICS[normalizar(dia)])
      .filter(Boolean),
  );
  return ORDEN_DIAS.filter((codigo) => codigos.has(codigo));
}

export function escaparTexto(texto: string) {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Corta en líneas de 75 octetos sin partir caracteres; la continuación empieza con espacio. */
export function plegarLinea(linea: string) {
  const partes: string[] = [];
  let actual = '';
  let octetos = 0;
  for (const caracter of linea) {
    const tam = Buffer.byteLength(caracter, 'utf8');
    const limite = partes.length ? 74 : 75;
    if (octetos + tam > limite) {
      partes.push(actual);
      actual = '';
      octetos = 0;
    }
    actual += caracter;
    octetos += tam;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

const fechaCompacta = (fecha: string) => fecha.replace(/-/g, '');
const horaCompacta = (hora: string) => `${hora.replace(':', '')}00`;

function utcCompacto(fecha: Date) {
  return fecha
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function sumarDias(fecha: string, dias: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(y, m - 1, d + dias));
  return resultado.toISOString().slice(0, 10);
}

function diaSemana(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  return ORDEN_DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Fecha local + hora local → instante UTC, con un desplazamiento fijo. */
function instante(fecha: string, hora: string, desplazamientoMin: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, hh, mm, 59) - desplazamientoMin * 60000,
  );
}

function desplazamientoTexto(minutos: number) {
  const signo = minutos < 0 ? '-' : '+';
  const abs = Math.abs(minutos);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${signo}${hh}${mm}`;
}

function eventoSemanal(
  evento: EventoSemanal,
  cal: Calendario,
): string[] | null {
  const dias = diasIcs(evento.dias);
  if (!dias.length) return null;
  // La primera clase real: el primer día del rango que toca según el horario.
  let primera = evento.desde;
  for (let i = 0; i < 7 && !dias.includes(diaSemana(primera)); i += 1) {
    primera = sumarDias(primera, 1);
  }
  if (primera > evento.hasta) return null;

  const tz = `TZID=${cal.zona}`;
  const excepciones = evento.excepciones
    .filter(
      (fecha) =>
        fecha >= primera &&
        fecha <= evento.hasta &&
        dias.includes(diaSemana(fecha)),
    )
    .sort();
  return [
    'BEGIN:VEVENT',
    `UID:${evento.uid}`,
    `DTSTAMP:${utcCompacto(cal.generado)}`,
    `SUMMARY:${escaparTexto(evento.resumen)}`,
    ...(evento.lugar ? [`LOCATION:${escaparTexto(evento.lugar)}`] : []),
    ...(evento.descripcion
      ? [`DESCRIPTION:${escaparTexto(evento.descripcion)}`]
      : []),
    `DTSTART;${tz}:${fechaCompacta(primera)}T${horaCompacta(evento.horaInicio)}`,
    `DTEND;${tz}:${fechaCompacta(primera)}T${horaCompacta(evento.horaFin)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${dias.join(',')};UNTIL=${utcCompacto(
      instante(evento.hasta, '23:59', cal.desplazamientoMin),
    )}`,
    ...(excepciones.length
      ? [
          `EXDATE;${tz}:${excepciones
            .map(
              (fecha) =>
                `${fechaCompacta(fecha)}T${horaCompacta(evento.horaInicio)}`,
            )
            .join(',')}`,
        ]
      : []),
    'END:VEVENT',
  ];
}

function eventoDiaCompleto(evento: EventoDiaCompleto, cal: Calendario) {
  return [
    'BEGIN:VEVENT',
    `UID:${evento.uid}`,
    `DTSTAMP:${utcCompacto(cal.generado)}`,
    `SUMMARY:${escaparTexto(evento.resumen)}`,
    ...(evento.descripcion
      ? [`DESCRIPTION:${escaparTexto(evento.descripcion)}`]
      : []),
    `DTSTART;VALUE=DATE:${fechaCompacta(evento.fecha)}`,
    `DTEND;VALUE=DATE:${fechaCompacta(sumarDias(evento.fecha, 1))}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

export function construirCalendario(cal: Calendario) {
  const desplazamiento = desplazamientoTexto(cal.desplazamientoMin);
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SICAT//Horario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparTexto(cal.nombre)}`,
    `X-WR-TIMEZONE:${cal.zona}`,
    // Los calendarios piden actualizar la suscripción cada pocas horas.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    'BEGIN:VTIMEZONE',
    `TZID:${cal.zona}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${desplazamiento}`,
    `TZOFFSETTO:${desplazamiento}`,
    'END:STANDARD',
    'END:VTIMEZONE',
    ...cal.semanales.flatMap((evento) => eventoSemanal(evento, cal) ?? []),
    ...cal.diasCompletos.flatMap((evento) => eventoDiaCompleto(evento, cal)),
    'END:VCALENDAR',
  ];
  return `${lineas.map(plegarLinea).join('\r\n')}\r\n`;
}
