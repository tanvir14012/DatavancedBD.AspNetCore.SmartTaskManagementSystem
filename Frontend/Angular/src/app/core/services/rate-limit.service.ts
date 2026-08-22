import { Injectable, computed, signal } from '@angular/core';
import { RateLimitState } from '../../shared/models/cdn.models';

/**
 * Tracks active 429 rate-limit windows per URL pattern.
 * Consumed by the `rateLimitInterceptor` and by UI components
 * (e.g., to disable submit buttons while a limit is active).
 */
@Injectable({ providedIn: 'root' })
export class RateLimitService {
  private readonly _limits = signal<Map<string, number>>(new Map());

  /** Snapshot of all currently active rate-limit states. */
  readonly activeLimits = computed<RateLimitState[]>(() => {
    const now = Date.now();
    const result: RateLimitState[] = [];

    for (const [urlPattern, expiresAt] of this._limits()) {
      if (expiresAt > now) {
        result.push({
          urlPattern,
          expiresAt,
          remainingSeconds: Math.ceil((expiresAt - now) / 1000),
        });
      }
    }
    return result;
  });

  /** Returns true when any tracked URL pattern is currently rate-limited. */
  readonly isAnyLimited = computed(() => this.activeLimits().length > 0);

  /**
   * Records a new rate-limit window for a given URL.
   * @param url        The full request URL.
   * @param retryAfterMs  Milliseconds until the window expires.
   */
  recordLimit(url: string, retryAfterMs: number): void {
    const pattern = this.toPattern(url);
    const expiresAt = Date.now() + retryAfterMs;

    this._limits.update((map) => {
      const next = new Map(map);
      next.set(pattern, expiresAt);
      return next;
    });

    // Auto-clear once the window passes so signals update
    setTimeout(() => this.clearLimit(url), retryAfterMs + 50);
  }

  /**
   * Returns whether the given URL is currently rate-limited.
   */
  isLimited(url: string): boolean {
    const pattern = this.toPattern(url);
    const expiresAt = this._limits().get(pattern);
    return expiresAt !== undefined && expiresAt > Date.now();
  }

  /**
   * Returns the remaining wait time in milliseconds for a URL, or 0 if not limited.
   */
  remainingMs(url: string): number {
    const pattern = this.toPattern(url);
    const expiresAt = this._limits().get(pattern);
    if (!expiresAt) return 0;
    return Math.max(0, expiresAt - Date.now());
  }

  clearLimit(url: string): void {
    const pattern = this.toPattern(url);
    this._limits.update((map) => {
      const next = new Map(map);
      next.delete(pattern);
      return next;
    });
  }

  clearAll(): void {
    this._limits.set(new Map());
  }

  /** Normalise a URL to a stable pattern by stripping query strings and IDs. */
  private toPattern(url: string): string {
    try {
      const u = new URL(url);
      // Strip numeric/UUID path segments so /api/v1/assets/123 and /api/v1/assets/456
      // are treated as the same endpoint pattern.
      const path = u.pathname
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{id}')
        .replace(/\/\d+/g, '/{id}');
      return `${u.origin}${path}`;
    } catch {
      return url.split('?')[0];
    }
  }
}
