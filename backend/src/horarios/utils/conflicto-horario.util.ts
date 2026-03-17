interface BloqueHorario {
  dias: string;
  horaInicio: string;
  horaFin: string;
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function hayConflictoHorario(a: BloqueHorario, b: BloqueHorario): boolean {
  const diasA = a.dias.split(',').map((d) => d.trim().toLowerCase());
  const diasB = b.dias.split(',').map((d) => d.trim().toLowerCase());

  const diasComunes = diasA.filter((d) => diasB.includes(d));
  if (diasComunes.length === 0) return false;

  const inicioA = aMinutos(a.horaInicio);
  const finA = aMinutos(a.horaFin);
  const inicioB = aMinutos(b.horaInicio);
  const finB = aMinutos(b.horaFin);

  return inicioA < finB && inicioB < finA;
}
