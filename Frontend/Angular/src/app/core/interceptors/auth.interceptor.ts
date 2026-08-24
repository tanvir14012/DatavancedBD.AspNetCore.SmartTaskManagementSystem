import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

const authEndpointPattern = /\/auth\/(login|register|refresh|logout)(?:$|\?)/i;
let refreshRequestInFlight = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('stms.token');
  const clonedRequest = req.clone({
    withCredentials: true,
    ...(token && !authEndpointPattern.test(req.url)
      ? {
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        }
      : {}),
  });

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || authEndpointPattern.test(req.url) || req.url.includes('/auth/logout')) {
        return throwError(() => error);
      }

      if (refreshRequestInFlight) {
        return throwError(() => error);
      }

      refreshRequestInFlight = true;

      return inject(HttpClient)
        .post<RefreshResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          switchMap((response) => {
            refreshRequestInFlight = false;
            const expiresAt = Date.now() + response.expiresIn * 1000;
            localStorage.setItem('stms.token', response.accessToken);
            localStorage.setItem('stms.expiresAt', String(expiresAt));

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
