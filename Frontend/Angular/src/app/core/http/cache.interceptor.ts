import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, tap } from 'rxjs';
import { HttpCacheService } from '../services/http-cache.service';

const CACHEABLE_METHODS = ['GET'];

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (!CACHEABLE_METHODS.includes(req.method)) return next(req);

  // Allow caller to bypass cache
  if (req.headers.has('X-No-Cache')) {
    return next(req.clone({ headers: req.headers.delete('X-No-Cache') }));
  }

  const cache = inject(HttpCacheService);
  const cacheKey = req.urlWithParams;
  const cached = cache.get(cacheKey);
  if (cached) return of(cached);

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(cacheKey, event);
      }
    }),
  );
};
