import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.http.get<UserListResult>(this.baseUrl, { params: httpParams, withCredentials: true });
  }

  create(payload: UserPayload): Observable<UserListItem> {
    return this.http.post<UserListItem>(this.baseUrl, payload, { withCredentials: true });
  }

  update(id: number, payload: UserPayload): Observable<UserListItem> {
    return this.http.put<UserListItem>(`${this.baseUrl}/${id}`, payload, { withCredentials: true });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }
}
