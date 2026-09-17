/**
 * Fechas con hora "de pared" (fecha límite de una tarea, día de un filtro) se
 * interpretan en la zona del plantel, no en la del servidor: en Render el
 * proceso corre en UTC y `new Date('2026-09-20T23:59')` vencería seis horas
 * antes de lo que el docente escribió.
 */
export const ZONA_HORARIA_DEFAULT = 'America/Mexico_City';

export function zonaHoraria(): string {
  return process.env.APP_TIMEZONE?.trim() || ZONA_HORARIA_DEFAULT;
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Fecha-hora sin desplazamiento (lo que manda el formulario): se toma como hora de pared.
const FECHA_HORA_LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

export function esHoraValida(hora: string) {
  return HORA.test(hora);
}

type Partes = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zona: string) {
  let cached = formatters.get(zona);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zona, cached);
  }
  return cached;
}

/** Hora de pared que marca el reloj de `zona` en el instante `fecha`. */
export function partesEnZona(fecha: Date, zona = zonaHoraria()): Partes {
  const partes: Record<string, number> = {};
  for (const parte of formatter(zona).formatToParts(fecha)) {
    if (parte.type !== 'literal') partes[parte.type] = Number(parte.value);
  }
  return {
    year: partes.year,
    month: partes.month,
    day: partes.day,
    hour: partes.hour === 24 ? 0 : partes.hour,
    minute: partes.minute,
    second: partes.second,
  };
}

function desplazamientoMs(instante: number, zona: string) {
  const p = partesEnZona(new Date(instante), zona);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instante
  );
}

/** Instante UTC que corresponde a la hora de pared dada en `zona`. */
export function instanteEnZona(
  partes: Omit<Partes, 'second'> & { second?: number },
  zona = zonaHoraria(),
): Date {
  const pared = Date.UTC(
    partes.year,
    partes.month - 1,
    partes.day,
    partes.hour,
    partes.minute,
    partes.second ?? 0,
  );
  // Dos pasadas para acertar el desplazamiento aun cerca de un cambio de horario.
  let instante = pared - desplazamientoMs(pared, zona);
  instante = pared - desplazamientoMs(instante, zona);
  return new Date(instante);
}

/**
 * Convierte la fecha límite que captura el docente en un instante. Acepta
 * `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` (hora de pared en la zona del plantel) o un
 * ISO con desplazamiento (`...Z`, `...-06:00`), que ya es un instante. `hora`
 * (HH:mm) manda sobre la hora incluida en `fecha`.
 */
export function resolverFechaHoraLimite(
  fecha: string,
  hora?: string | null,
  zona = zonaHoraria(),
): Date | null {
  const horaPartes = hora ? hora.split(':').map(Number) : null;
  const local = FECHA_HORA_LOCAL.exec(fecha) ?? FECHA.exec(fecha);
  if (local) {
    const [, y, m, d, hh, mm] = local;
    return instanteEnZona(
      {
        year: Number(y),
        month: Number(m),
        day: Number(d),
        hour: horaPartes ? horaPartes[0] : hh !== undefined ? Number(hh) : 23,
        minute: horaPartes ? horaPartes[1] : mm !== undefined ? Number(mm) : 59,
      },
      zona,
    );
  }
  const instante = new Date(fecha);
  if (Number.isNaN(instante.getTime())) return null;
  if (!horaPartes) return instante;
  const p = partesEnZona(instante, zona);
  return instanteEnZona(
    { ...p, hour: horaPartes[0], minute: horaPartes[1], second: 0 },
    zona,
  );
}

/** `HH:mm` de pared en la zona del plantel. */
export function formatearHoraEnZona(
  fecha: Date | null | undefined,
  zona = zonaHoraria(),
) {
  if (!fecha) return null;
  const p = partesEnZona(fecha, zona);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Principio y fin (inclusive) de un día `YYYY-MM-DD` en la zona del plantel. */
export function rangoDiaEnZona(fecha: string, zona = zonaHoraria()) {
  const match = FECHA.exec(fecha);
  if (!match) return null;
  const [, y, m, d] = match;
  const base = { year: Number(y), month: Number(m), day: Number(d) };
  const inicio = instanteEnZona({ ...base, hour: 0, minute: 0 }, zona);
  const fin = instanteEnZona(
    { ...base, hour: 23, minute: 59, second: 59 },
    zona,
  );
  fin.setUTCMilliseconds(999);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()))
    return null;
  return { inicio, fin };
}
