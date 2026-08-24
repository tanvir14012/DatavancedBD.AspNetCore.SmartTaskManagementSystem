import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardBreakdownItem {
  key: string;
  value: number;
}

export interface DashboardUrgentTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  projectId: number;
}

export interface DashboardSummary {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  statusBreakdown: DashboardBreakdownItem[];
  priorityBreakdown: DashboardBreakdownItem[];
  urgentTasks: DashboardUrgentTask[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly baseUrl = `${environment.apiBaseUrl}/dashboard`;
  private readonly summaryCache = new Map<string, Observable<DashboardSummary>>();

  constructor(private readonly http: HttpClient) {}

  getSummary(projectId?: number, forceReload = false): Observable<DashboardSummary> {
    const cacheKey = `summary:${projectId ?? 'all'}`;
    const cached = this.summaryCache.get(cacheKey);

    if (cached && !forceReload) {
      return cached;
    }

    if (forceReload) {
      this.summaryCache.delete(cacheKey);
    }

    let params = new HttpParams();

    if (projectId !== undefined && projectId !== null) {
      params = params.set('projectId', String(projectId));
    }

    const request$ = this.http
      .get<DashboardSummary>(`${this.baseUrl}/summary`, {
        params,
        withCredentials: true,
      })
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.summaryCache.set(cacheKey, request$);
    return request$;
  }

  clearCache(): void {
    this.summaryCache.clear();
  }
}
