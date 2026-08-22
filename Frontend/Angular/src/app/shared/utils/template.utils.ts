export interface Identifiable {
  id: string | number;
}

export function trackById<T extends Identifiable>(_index: number, item: T): T['id'] {
  return item.id;
}

export function trackByIndex(index: number): number {
  return index;
}

export function displayOrDash(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

export function yesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '-';
}

export function stopEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}
