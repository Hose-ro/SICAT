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
