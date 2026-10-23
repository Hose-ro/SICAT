export function normalizeName(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Cada institución arma su número de control distinto: sólo se exige que sea
 * alfanumérico (letras y números, sin espacios ni signos), de cualquier largo.
 */
export const NUMERO_CONTROL_PATRON = /^[A-Za-z0-9]+$/;
export const NUMERO_CONTROL_MENSAJE =
  'El número de control sólo puede tener letras y números';

export function normalizeControlNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function transformString(
  value: unknown,
  normalizer: (input: string) => string,
): unknown {
  return typeof value === 'string' ? normalizer(value) : value;
}

export function trimString(value: unknown): unknown {
  return transformString(value, (input) => input.trim());
}
