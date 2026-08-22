import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MemoryCache } from '../../shared/utils/cache.utils';

@Injectable({ providedIn: 'root' })
export class HttpCacheService {
  private readonly cache = new MemoryCache<HttpResponse<unknown>>();
  private readonly ttl = environment.cacheTtlMs;

  get(url: string): HttpResponse<unknown> | null {
    return this.cache.get(url);
  }

  set(url: string, response: HttpResponse<unknown>): void {
    this.cache.set(url, response, this.ttl);
  }

  invalidate(urlPattern?: string): void {
    if (!urlPattern) {
      this.cache.clear();
      return;
    }
    this.cache.invalidate((key) => key.includes(urlPattern));
  }
}
