import { InjectionToken } from '@angular/core';

/** Runtime deployment bindings; never a tenant inventory or storage configuration. */
export interface TenantApiPolicyOptions {
  readonly baseUrl: string;
  readonly allowedOrigins: readonly string[];
}

/** Exact URL-origin matching. Supply once from validated runtime bootstrap configuration. */
export class TenantApiPolicy {
  private readonly baseUrl: string;
  private readonly origins: ReadonlySet<string>;

  constructor(options: TenantApiPolicyOptions) {
    const base = this.parseAbsolute(options.baseUrl);
    if (base.search || base.hash) {
      throw new Error('Tenant API base URL must not contain a query or fragment.');
    }
    if (!options.allowedOrigins.length) {
      throw new Error('At least one tenant API origin is required.');
    }
    this.baseUrl = base.href;
    this.origins = new Set(options.allowedOrigins.map((value) => {
      const url = this.parseAbsolute(value);
      if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Tenant API allowlist entries must be origins without paths.');
      }
      return url.origin;
    }));
  }

  /** Non-API and malformed URLs never receive organization context. */
  includes(requestUrl: string): boolean {
    try {
      const url = new URL(requestUrl, this.baseUrl);
      return !url.username && !url.password && this.origins.has(url.origin);
    } catch {
      return false;
    }
  }

  private parseAbsolute(value: string): URL {
    try {
      if (value.trim() !== value || /[\u0000-\u001f\u007f\\]/u.test(value)) {
        throw new Error();
      }
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        throw new Error();
      }
      return url;
    } catch {
      throw new Error('Tenant API configuration requires valid HTTP(S) URLs without credentials.');
    }
  }
}

/** No default or build-time environment import: composition must supply runtime bindings. */
export const TENANT_API_POLICY = new InjectionToken<TenantApiPolicy>('Tenant API policy');
