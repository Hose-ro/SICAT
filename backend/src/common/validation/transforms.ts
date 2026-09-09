import { Transform } from 'class-transformer';

export function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

// Unlike Number(), never accept booleans, empty strings, arrays or hex notation.
export function toNumber(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toNumber);
  if (typeof value === 'number' || value === null || value === undefined)
    return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))
    return Number(value);
  return Number.NaN;
}

export function ToNumber() {
  return Transform(({ value }: { value: unknown }) => toNumber(value));
}

// These are plain-text fields (no rich text editor anywhere in the app), so
// any markup is stripped entirely rather than allow-listing safe tags.
export function stripHtml(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripHtml);
  if (typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '').trim();
}

export function SanitizeText() {
  return Transform(({ value }: { value: unknown }) => stripHtml(value));
}
