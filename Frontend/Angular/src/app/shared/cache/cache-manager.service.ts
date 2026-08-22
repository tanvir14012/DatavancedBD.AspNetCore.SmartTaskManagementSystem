import { DestroyRef, inject, Injectable, makeStateKey, TransferState } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

import { PlatformContextService } from '../ssr/platform-context.service';

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

interface TransferCacheEntry {
  value: unknown;
  expiresAt: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class CacheManagerService {
  private readonly transferState = inject(TransferState);
  private readonly platformContext = inject(PlatformContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cleanupIntervalMs = 60_000;

  constructor() {
    interval(this.cleanupIntervalMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cleanupExpiredEntries());
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null;
    const entry: CacheEntry<T> = { value, expiresAt };

    this.cache.set(key, entry);

    if (this.platformContext.isServer) {
      this.transferState.set(this.getTransferKey(key), {
        value,
        expiresAt,
      });
    }
  }

  get<T>(key: string): T | null {
    const fromMemory = this.cache.get(key);
    const hydrated = fromMemory ?? this.hydrateFromTransferState(key);
    if (!hydrated) {
      return null;
    }

    if (this.isExpired(hydrated.expiresAt)) {
      this.delete(key);
      return null;
    }

    return hydrated.value as T;
  }

  getOrSet<T>(key: string, producer: () => T, ttlMs?: number): T {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = producer();
    this.set(key, value, ttlMs);
    return value;
  }

  has(key: string): boolean {
    return this.get<unknown>(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.transferState.remove(this.getTransferKey(key));
  }

  clear(): void {
    for (const key of this.cache.keys()) {
      this.transferState.remove(this.getTransferKey(key));
    }
    this.cache.clear();
  }

  private cleanupExpiredEntries(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry.expiresAt)) {
        this.cache.delete(key);
        this.transferState.remove(this.getTransferKey(key));
      }
    }
  }

  private hydrateFromTransferState(key: string): CacheEntry<unknown> | null {
    if (!this.platformContext.isBrowser) {
      return null;
    }

    const stateKey = this.getTransferKey(key);
    if (!this.transferState.hasKey(stateKey)) {
      return null;
    }

    const hydratedEntry = this.transferState.get<TransferCacheEntry>(stateKey, {
      value: null,
      expiresAt: null,
    });
    this.transferState.remove(stateKey);

    if (this.isExpired(hydratedEntry.expiresAt)) {
      return null;
    }

    const entry: CacheEntry<unknown> = {
      value: hydratedEntry.value,
      expiresAt: hydratedEntry.expiresAt,
    };
    this.cache.set(key, entry);
    return entry;
  }

  private isExpired(expiresAt: number | null): boolean {
    return expiresAt !== null && Date.now() > expiresAt;
  }

  private getTransferKey(key: string) {
    return makeStateKey<TransferCacheEntry>(`CACHE_MANAGER:${key}`);
  }
}
