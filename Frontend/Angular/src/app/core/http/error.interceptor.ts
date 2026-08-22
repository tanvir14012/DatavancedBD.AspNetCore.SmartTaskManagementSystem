import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          auth.logout();
          break;
        case 403:
          router.navigate(['/forbidden']);
          break;
        case 404:
          // Let caller handle 404 locally; optionally navigate
          break;
        case 422:
        case 400:
          // Validation errors – returned to caller for form binding
          break;
        case 429:
          // Rate limit exhausted (after retries in rateLimitInterceptor)
          console.warn('Rate limit exceeded. Please slow down.', error);
          break;
        case 500:
        case 503:
          console.error('HTTP server error', error);
          break;
        default:
          if (!navigator.onLine) {
            console.warn('Network offline. Please check your connection.');
          }
      }
      return throwError(() => error);
    }),
  );
};
