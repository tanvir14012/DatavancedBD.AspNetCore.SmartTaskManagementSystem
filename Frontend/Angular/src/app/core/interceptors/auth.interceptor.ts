import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

const authEndpointPattern = /\/auth\/(login|register|refresh|logout)(?:$|\?)/i;

let refreshRequestInFlight = false;
let refreshRetryCount = 0;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('stms.token');
  const withCredentialsRequest = req.clone({
    withCredentials: true,
    ...(token && !authEndpointPattern.test(req.url)
      ? { setHeaders: { Authorization: `Bearer ${token}` } }
      : {}),
  });

  return next(withCredentialsRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || authEndpointPattern.test(req.url) || req.url.includes('/auth/logout')) {
        return throwError(() => error);
      }

      if (refreshRequestInFlight) {
        return throwError(() => error);
      }

      const maxRetries = 3;
      if (refreshRetryCount >= maxRetries) {
        refreshRetryCount = 0;
        inject(Router).navigateByUrl('/login');
        localStorage.removeItem('stms.token');
        localStorage.removeItem('stms.user');
        localStorage.removeItem('stms.expiresAt');
        return throwError(() => error);
      }

      refreshRequestInFlight = true;
      refreshRetryCount += 1;

      return inject(HttpClient)
        .post<RefreshResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          switchMap((response) => {
            refreshRequestInFlight = false;
            refreshRetryCount = 0;

            localStorage.setItem('stms.token', response.accessToken);
            localStorage.setItem('stms.expiresAt', String(Date.now() + response.expiresIn * 1000));

            const retriedRequest = req.clone({
              withCredentials: true,
              setHeaders: {
                Authorization: `Bearer ${response.accessToken}`,
              },
            });

            return next(retriedRequest);
          }),
          catchError((refreshError) => {
            refreshRequestInFlight = false;
            inject(Router).navigateByUrl('/login');
            localStorage.removeItem('stms.token');
            localStorage.removeItem('stms.user');
            localStorage.removeItem('stms.expiresAt');
            return throwError(() => refreshError);
          }),
        );
    }),
  );
};
