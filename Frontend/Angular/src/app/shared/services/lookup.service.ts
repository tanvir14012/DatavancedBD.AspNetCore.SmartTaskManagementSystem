import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { LookupItem, LookupMap } from '../models/lookup.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);
  private readonly _cache = new Map<string, Observable<LookupItem[]>>();

  /** Fetch & cache a lookup by its API key. */
  getLookup(key: string): Observable<LookupItem[]> {
    if (!this._cache.has(key)) {
      const url = `${environment.apiGatewayUrl}/lookups/${key}`;
      this._cache.set(key, this.http.get<LookupItem[]>(url).pipe(shareReplay(1)));
    }
    return this._cache.get(key)!;
  }

  /** Invalidate a cached lookup (e.g. after mutation). */
  invalidate(key: string): void {
    this._cache.delete(key);
  }

  clearAll(): void {
    this._cache.clear();
  }
}
