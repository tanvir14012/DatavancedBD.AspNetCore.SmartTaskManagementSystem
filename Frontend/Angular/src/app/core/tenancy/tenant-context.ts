import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Browser-visible organization selection; never contains physical placement or credentials. */
export interface TenantContext {
  readonly tenantId: string;
  readonly displayName: string;
}

/** Capture once when starting work, then discard results if the generation changes. */
export interface TenantContextSnapshot {
  readonly context: TenantContext | null;
  readonly generation: number;
}

/**
 * In-memory organization selection for one application instance.
 *
 * Register explicitly when organization discovery and authenticated API validation are wired.
 * A selected organization is a request selector, never proof of access authorization.
 */
@Injectable()
export class TenantContextStore {
  private readonly state = new BehaviorSubject<TenantContextSnapshot>(
    Object.freeze({ context: null, generation: 0 }),
  );

  /** Replays the current snapshot. Filter on generation to observe identity transitions only. */
  readonly changes$: Observable<TenantContextSnapshot> = this.state.asObservable();

  current(): TenantContext | null {
    return this.state.value.context;
  }

  snapshot(): TenantContextSnapshot {
    return this.state.value;
  }

  /** Call with an organization returned by authenticated discovery/selection, not persisted state. */
  set(selection: TenantContext): TenantContextSnapshot {
    const context = this.validateAndCopy(selection);
    const previous = this.snapshot();

    if (
      previous.context?.tenantId === context.tenantId &&
      previous.context.displayName === context.displayName
    ) {
      return previous;
    }

    const generation =
      previous.context?.tenantId === context.tenantId
        ? previous.generation
        : this.nextGeneration(previous.generation);
    const snapshot: TenantContextSnapshot = Object.freeze({ context, generation });
    this.state.next(snapshot);
    return snapshot;
  }

  /** Clear on sign-out or before abandoning the current organization. Already-clear is a no-op. */
  clear(): void {
    const previous = this.snapshot();
    if (previous.context === null) {
      return;
    }

    this.state.next(
      Object.freeze({ context: null, generation: this.nextGeneration(previous.generation) }),
    );
  }

  private validateAndCopy(selection: TenantContext): TenantContext {
    if (
      selection === null ||
      typeof selection !== 'object' ||
      typeof selection.tenantId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        selection.tenantId,
      ) ||
      selection.tenantId === '00000000-0000-0000-0000-000000000000'
    ) {
      throw new TypeError('Organization ID must be a nonempty UUID in canonical format.');
    }

    if (typeof selection.displayName !== 'string') {
      throw new TypeError('Organization display name must be a string.');
    }

    const displayName = selection.displayName.trim();
    if (
      displayName.length === 0 ||
      displayName.length > 200 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(selection.displayName)
    ) {
      throw new TypeError('Organization display name must contain 1–200 characters without controls.');
    }

    return Object.freeze({ tenantId: selection.tenantId.toLowerCase(), displayName });
  }

  private nextGeneration(generation: number): number {
    if (generation === Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Organization context generation is exhausted. Reload the application.');
    }

    return generation + 1;
  }
}
