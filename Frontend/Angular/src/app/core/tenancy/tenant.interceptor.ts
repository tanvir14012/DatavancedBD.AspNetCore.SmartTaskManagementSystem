import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, filter, mergeMap, take, takeUntil, throwError } from 'rxjs';
import { TENANT_API_POLICY } from './tenant-api-policy';
import { TenantContextSnapshot, TenantContextStore } from './tenant-context';

/** Explicit opt-out for organization discovery/auth endpoints; the server still authorizes access. */
export const SKIP_TENANT_CONTEXT = new HttpContextToken<boolean>(() => false);
const REQUEST_TENANT_SNAPSHOT = new HttpContextToken<TenantContextSnapshot | null>(() => null);
const tenantHeader = 'X-Tenant-ID';
const tenantFreeAuthEndpoint = /\/auth\/(login|register|refresh|logout)(?:$|[/?])/i;

/** Callers may distinguish a canceled organization operation from a transport failure. */
export class TenantRequestContextError extends Error {
  constructor(readonly reason: 'missing' | 'conflict' | 'changed') {
    super(`Tenant request context is ${reason}.`);
    this.name = 'TenantRequestContextError';
  }
}

/**
 * Requires the Fetch backend for redirect prevention. Intentionally unregistered until the
 * organization-bound authentication pipeline is ready. Tenant headers are selectors, not credentials.
 */
export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const policy = inject(TENANT_API_POLICY);
  const store = inject(TenantContextStore);
  if (
    !policy.includes(request.url) ||
    request.context.get(SKIP_TENANT_CONTEXT) ||
    tenantFreeAuthEndpoint.test(request.url)
  ) {
    return next(request.clone({ headers: request.headers.delete(tenantHeader) }));
  }

  const current = store.snapshot();
  const captured = request.context.get(REQUEST_TENANT_SNAPSHOT) ?? current;
  if (captured.generation !== current.generation) {
    return throwError(() => new TenantRequestContextError('changed'));
  }
  if (!captured.context) {
    return throwError(() => new TenantRequestContextError('missing'));
  }
  const tenantId = captured.context.tenantId;
  const supplied = request.headers.getAll(tenantHeader);
  if (supplied && (supplied.length !== 1 || supplied[0].toLowerCase() !== tenantId)) {
    return throwError(() => new TenantRequestContextError('conflict'));
  }

  // HttpContext survives cloning/retry. A logical request cannot acquire a different organization
  // on resubscription, including switching A -> B -> A while a retry is waiting.
  request.context.set(REQUEST_TENANT_SNAPSHOT, captured);
  const scoped = request.clone({
    setHeaders: { [tenantHeader]: tenantId },
    redirect: 'error',
    cache: 'no-store',
    transferCache: false,
  });
  const changed = store.changes$.pipe(
    filter((snapshot) => snapshot.generation !== captured.generation),
    take(1),
    mergeMap(() => throwError(() => new TenantRequestContextError('changed'))),
  );

  // Subscribe to change detection before dispatch. Unsubscribing also discards late response events;
  // it cannot undo a write that the server already accepted.
  return defer(() => next(scoped)).pipe(takeUntil(changed));
};
