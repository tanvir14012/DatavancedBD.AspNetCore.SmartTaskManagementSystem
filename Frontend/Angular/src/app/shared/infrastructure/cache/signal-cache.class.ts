import { Signal, WritableSignal, signal } from '@angular/core';
import { ICache } from './cache.interface';

/**
 * Signal-backed Cache using Angular Signals
 */
export class SignalCache<K, V> implements ICache<K, V> {
  private cache = new Map<K, WritableSignal<V>>();
  private keys = signal<K[]>([]);

  get(key: K): V | undefined {
    return this.cache.get(key)?.();
  }

  getSignal(key: K): Signal<V> | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.get(key)!.set(value);
    } else {
      this.cache.set(key, signal(value));
      this.keys.update(k => [...k, key]);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.keys.update(k => k.filter(x => x !== key));
    }
    return result;
  }

  clear(): void {
    this.cache.clear();
    this.keys.set([]);
  }

  size(): number {
    return this.cache.size;
  }

  getKeys(): Signal<K[]> {
    return this.keys;
  }
}
