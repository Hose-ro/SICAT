const DIA_SEMANA: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
};

export function normalizarTexto(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function obtenerDiaCanonico(date: Date) {
  return DIA_SEMANA[date.getDay()] ?? '';
}

export function horarioAplicaEnFecha(dias: string, date: Date) {
  const diaActual = obtenerDiaCanonico(date);
  return dias
    .split(',')
    .map((dia) => normalizarTexto(dia))
    .includes(diaActual);
}

export function convertirHoraAMinutos(hora: string) {
  const [hours, minutes] = hora.split(':').map((chunk) => Number(chunk));
  return hours * 60 + minutes;
}

export function convertirFechaAMinutos(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function estaDentroDelHorario(
  date: Date,
  horaInicio: string,
  horaFin: string,
) {
  const actual = convertirFechaAMinutos(date);
  return (
    actual >= convertirHoraAMinutos(horaInicio) &&
    actual <= convertirHoraAMinutos(horaFin)
  );
}

export function obtenerInicioDelDia(date: Date) {
  const inicio = new Date(date);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export function obtenerFinDelDia(date: Date) {
  const fin = new Date(date);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

export function obtenerInicioDeSemana(date: Date) {
  const inicio = obtenerInicioDelDia(date);
  const dia = inicio.getDay();
  const ajuste = dia === 0 ? -6 : 1 - dia;
  inicio.setDate(inicio.getDate() + ajuste);
  return inicio;
}

export function obtenerClaveSemana(date: Date) {
  return formatearFechaClave(obtenerInicioDeSemana(date));
}

export function formatearFechaClave(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mismoDia(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false;
  return obtenerInicioDelDia(a).getTime() === obtenerInicioDelDia(b).getTime();
}
