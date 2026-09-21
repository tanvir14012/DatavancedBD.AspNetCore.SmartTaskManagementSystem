import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { tenantInterceptor } from './core/tenancy/tenant.interceptor';
import { TENANT_API_POLICY, TenantApiPolicy } from './core/tenancy/tenant-api-policy';
import { TenantContextStore } from './core/tenancy/tenant-context';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

declare global {
  interface Window {
    __STMS_TENANT__?: { tenantId: string; displayName: string };
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    TenantContextStore,
    provideAppInitializer(() => {
      const store = inject(TenantContextStore);
      const localTenant = window.__STMS_TENANT__;
      if (localTenant) store.set(localTenant);
    }),
    {
      provide: TENANT_API_POLICY,
      useFactory: () => {
        const baseUrl = new URL(environment.apiBaseUrl, window.location.origin);
        return new TenantApiPolicy({
          baseUrl: baseUrl.href,
          allowedOrigins: [baseUrl.origin],
        });
      },
    },
    provideHttpClient(withFetch(), withInterceptors([tenantInterceptor, authInterceptor])),
    provideAnimationsAsync(),
  ],
};
