import { ITTLCache } from './cache.interface';

/**
 * TTL (Time-To-Live) Cache implementation
 */
export class TTLCache<K, V> implements ITTLCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(private defaultTTLMs: number = 60000) {
    this.startCleanup();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  getWithTTL(key: K): { value: V; ttl: number } | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    const ttl = entry.expiresAt - Date.now();
    if (ttl <= 0) {
      this.cache.delete(key);
      return undefined;
    }

    return { value: entry.value, ttl };
  }

  set(key: K, value: V): void {
    this.setWithTTL(key, value, this.defaultTTLMs);
  }

  setWithTTL(key: K, value: V, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 10000); // Cleanup every 10 seconds
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}
