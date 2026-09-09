export function getCurrentAcademicPeriod(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const suffix = month <= 6 ? 'A' : 'B';
  return `${year}-${suffix}`;
}

export function normalizeAcademicPeriod(period?: string | null): string {
  if (!period) return getCurrentAcademicPeriod();
  const trimmed = period.trim().toUpperCase();
  return trimmed || getCurrentAcademicPeriod();
}

/**
 * Primer día del periodo académico: 1 de enero para los periodos `A`
 * (enero–junio) y 1 de julio para los `B` (julio–diciembre). Marca hasta dónde
 * se puede mirar hacia atrás dentro del periodo en curso.
 */
export function getAcademicPeriodStart(referenceDate = new Date()): Date {
  const month = referenceDate.getMonth() + 1;
  return new Date(
    referenceDate.getFullYear(),
    month <= 6 ? 0 : 6,
    1,
    0,
    0,
    0,
    0,
  );
}
