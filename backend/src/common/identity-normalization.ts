export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

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
