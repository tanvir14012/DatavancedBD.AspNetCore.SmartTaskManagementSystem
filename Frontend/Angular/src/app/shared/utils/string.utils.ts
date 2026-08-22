/** Trims whitespace; returns null for empty strings. */
export function nullIfEmpty(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** Truncate to max length with ellipsis. */
export function truncate(value: string, maxLength: number): string {
  if (!value || value.length <= maxLength) return value ?? '';
  return `${value.slice(0, maxLength - 3)}...`;
}

/** Convert 'camelCase' to 'Camel Case' */
export function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Slugify a string for URL or class use. */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Check if a string is a valid UUID. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
