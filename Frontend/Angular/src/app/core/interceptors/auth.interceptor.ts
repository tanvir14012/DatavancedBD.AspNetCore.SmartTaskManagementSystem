import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpContextToken } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantContextStore } from '../tenancy/tenant-context';

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

const authEndpointPattern = /\/auth\/(login|register|refresh|logout)(?:$|\?)/i;
const authRetried = new HttpContextToken<boolean>(() => false);
let refreshRequestInFlight: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const tenantStore = inject(TenantContextStore);
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
      if (
        error.status !== 401 ||
        authEndpointPattern.test(req.url) ||
        req.context.get(authRetried)
      ) {
        return throwError(() => error);
      }

      const refresh$ = refreshRequestInFlight ??= http
        .post<RefreshResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          map((response) => {
            const expiresAt = Date.now() + response.expiresIn * 1000;
            localStorage.setItem('stms.token', response.accessToken);
            localStorage.setItem('stms.expiresAt', String(expiresAt));
            return response.accessToken;
          }),
          catchError((refreshError) => {
            inject(Router).navigateByUrl('/login');
            tenantStore.clear();
            localStorage.removeItem('stms.token');
            localStorage.removeItem('stms.user');
            localStorage.removeItem('stms.expiresAt');
            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshRequestInFlight = null;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );

      return refresh$.pipe(
        switchMap((accessToken) => next(req.clone({
          context: req.context.set(authRetried, true),
          withCredentials: true,
          setHeaders: { Authorization: `Bearer ${accessToken}` },
        }))),
      );
    }),
  );
};
