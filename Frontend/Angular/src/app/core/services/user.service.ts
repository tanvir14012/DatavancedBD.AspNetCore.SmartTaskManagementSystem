import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserListItem {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserListResult {
  page: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
  totalPages: number;
  items: UserListItem[];
}

export interface UserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;
  private readonly listCache = new Map<string, Observable<UserListResult>>();

  constructor(private readonly http: HttpClient) {}

  list(params: {
    start?: number;
    length?: number;
    search?: string;
    sortColumn?: string;
    sortDirection?: string;
    role?: string;
    status?: string;
  } = {}): Observable<UserListResult> {
    const normalizedParams = this.normalizeParams(params);
    const cacheKey = JSON.stringify(normalizedParams);
    const cached = this.listCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    let httpParams = new HttpParams();
    Object.entries(normalizedParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    const request$ = this.http
      .get<UserListResult>(this.baseUrl, { params: httpParams, withCredentials: true })
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.listCache.set(cacheKey, request$);
    return request$;
  }

  private normalizeParams(params: {
    start?: number;
    length?: number;
    search?: string;
    sortColumn?: string;
    sortDirection?: string;
    role?: string;
    status?: string;
  }): Record<string, string | number | undefined> {
    const normalized: Record<string, string | number | undefined> = { ...params };
    const sortColumn = normalized['sortColumn'];

    if (typeof sortColumn === 'string' && sortColumn.trim()) {
      normalized['sortColumn'] = this.normalizeSortColumn(sortColumn);
    }

    return normalized;
  }

  private normalizeSortColumn(column: string): string {
    switch (column.trim().toLowerCase()) {
      case 'firstname':
        return 'FirstName';
      case 'lastname':
        return 'LastName';
      case 'email':
        return 'Email';
      case 'createdat':
        return 'CreatedAt';
      default:
        return column;
    }
  }

  clearListCache(): void {
    this.listCache.clear();
  }

  create(payload: UserPayload): Observable<UserListItem> {
    this.clearListCache();
    return this.http.post<UserListItem>(this.baseUrl, payload, { withCredentials: true });
  }

  update(id: number, payload: UserPayload): Observable<UserListItem> {
    this.clearListCache();
    return this.http.put<UserListItem>(`${this.baseUrl}/${id}`, payload, { withCredentials: true });
  }

  delete(id: number): Observable<void> {
    this.clearListCache();
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }
}
