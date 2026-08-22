import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { RateLimitService } from '../services/rate-limit.service';

/** Maximum number of automatic retries before propagating a 429 to the caller. */
const MAX_RETRIES = 2;
/** Fallback wait time in ms when the server does not send a Retry-After header. */
const DEFAULT_RETRY_AFTER_MS = 5_000;
/** Upper bound on any Retry-After value (prevents waiting for hours). */
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Intercepts HTTP 429 Too Many Requests responses, parses the `Retry-After`
 * header, notifies `RateLimitService`, and automatically retries the request
 * up to `MAX_RETRIES` times after the appropriate delay.
 *
 * After exhausting retries the original 429 error is re-thrown so that
 * `errorInterceptor` can surface it to the user.
 */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  const rateLimitSvc = inject(RateLimitService);

  return executeWithRetry(req, next, rateLimitSvc, 0);
};

function executeWithRetry(
  req: Parameters<HttpInterceptorFn>[0],
  next: Parameters<HttpInterceptorFn>[1],
  rateLimitSvc: RateLimitService,
  attempt: number,
): ReturnType<HttpInterceptorFn> {
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 429) {
        return throwError(() => error);
      }

      const retryAfterMs = parseRetryAfter(error);
      rateLimitSvc.recordLimit(req.url, retryAfterMs);

      if (attempt >= MAX_RETRIES) {
        return throwError(() => error);
      }

      // Wait for the rate-limit window then retry
      return timer(retryAfterMs).pipe(
        switchMap(() => executeWithRetry(req, next, rateLimitSvc, attempt + 1)),
      );
    }),
  );
}

/**
 * Parses the `Retry-After` response header.
 * Supports both delta-seconds format and HTTP-date format.
 */
function parseRetryAfter(error: HttpErrorResponse): number {
  const header = error.headers?.get('Retry-After');
  if (!header) return DEFAULT_RETRY_AFTER_MS;

  // Delta-seconds: "Retry-After: 30"
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }

  // HTTP-date: "Retry-After: Wed, 21 Oct 2015 07:28:00 GMT"
  const date = new Date(header).getTime();
  if (!isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
  }

  return DEFAULT_RETRY_AFTER_MS;
}
