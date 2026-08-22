/**
 * Cache interfaces
 */

export interface ICache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
}

export interface ITTLCache<K, V> extends ICache<K, V> {
  getWithTTL(key: K): { value: V; ttl: number } | undefined;
  setWithTTL(key: K, value: V, ttlMs: number): void;
}
