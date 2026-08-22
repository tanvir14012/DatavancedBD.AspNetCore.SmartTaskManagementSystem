import { Injectable, signal, WritableSignal } from '@angular/core';

/**
 * Global loading state service
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private loading$ = signal(false);
  private loadingCount$ = signal(0);

  getLoading() {
    return this.loading$.asReadonly();
  }

  startLoading(): void {
    this.loadingCount$.update(c => c + 1);
    this.loading$.set(true);
  }

  stopLoading(): void {
    this.loadingCount$.update(c => Math.max(0, c - 1));
    if (this.loadingCount$() === 0) {
      this.loading$.set(false);
    }
  }

  reset(): void {
    this.loading$.set(false);
    this.loadingCount$.set(0);
  }
}
