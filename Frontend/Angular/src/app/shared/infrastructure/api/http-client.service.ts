import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IAPIResponse } from '../../core/adapter/api-adapter.class';

/**
 * HTTP Client service for API communication
 */
@Injectable({ providedIn: 'root' })
export class APIClientService {
  constructor(private http: HttpClient) {}

  get<T>(url: string, options?: any): Observable<IAPIResponse<T>> {
    return this.http.get<IAPIResponse<T>>(url, options);
  }

  post<T>(url: string, body: any, options?: any): Observable<IAPIResponse<T>> {
    return this.http.post<IAPIResponse<T>>(url, body, options);
  }

  put<T>(url: string, body: any, options?: any): Observable<IAPIResponse<T>> {
    return this.http.put<IAPIResponse<T>>(url, body, options);
  }

  patch<T>(url: string, body: any, options?: any): Observable<IAPIResponse<T>> {
    return this.http.patch<IAPIResponse<T>>(url, body, options);
  }

  delete<T>(url: string, options?: any): Observable<IAPIResponse<T>> {
    return this.http.delete<IAPIResponse<T>>(url, options);
  }

  head<T>(url: string, options?: any): Observable<IAPIResponse<T>> {
    return this.http.head<IAPIResponse<T>>(url, options);
  }

  options<T>(url: string, options?: any): Observable<IAPIResponse<T>> {
    return this.http.options<IAPIResponse<T>>(url, options);
  }
}
