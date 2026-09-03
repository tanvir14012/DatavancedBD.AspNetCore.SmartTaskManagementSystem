import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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

  private readonly http = inject(HttpClient);

  getSummary(projectId?: number, forceReload = false): Observable<DashboardSummary> {
    let params = new HttpParams();

    if (projectId !== undefined && projectId !== null) {
      params = params.set('projectId', String(projectId));
    }

    return this.http.get<DashboardSummary>(`${this.baseUrl}/summary`, {
      params,
      withCredentials: true,
    });
  }

  clearCache(): void {
    // This service no longer caches summary responses. Keeping the hook for compatibility with auth/session resets.
  }
}
