export interface CacheValue<T> {
  value: T;
  expiresAt: number;
}

export function isCacheExpired(entry: CacheValue<unknown>, now = Date.now()): boolean {
  return now > entry.expiresAt;
}

export function createCacheKey(url: string, params?: Record<string, unknown>): string {
  if (!params) return url;

  const normalized = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return normalized ? `${url}?${normalized}` : url;
}

export class MemoryCache<T> {
  private readonly entries = new Map<string, CacheValue<T>>();

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (isCacheExpired(entry)) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  invalidate(predicate: (key: string) => boolean): void {
    for (const key of this.entries.keys()) {
      if (predicate(key)) this.entries.delete(key);
    }
  }
}
