import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProjectItemMember {
  userId: number;
  userName: string;
  email: string;
  role: string;
}

export interface ProjectListItem {
  id: number;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
  status?: string;
  role?: string;
  taskCount?: number;
  updatedAt?: string;
}

export interface ProjectDetail {
  id: number;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
  members: ProjectItemMember[];
}

export interface ProjectListResult {
  page: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
  totalPages: number;
  items: ProjectListItem[];
}

export interface ProjectCreateRequest {
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isArchived?: boolean;
}

export interface ProjectMemberAssignment { userId: number; role: 'Owner' | 'Manager' | 'Member' | 'Viewer'; }

export interface ProjectAssignmentItem {
  projectId: number;
  projectName: string;
  userId: number;
  userName: string;
  email: string;
  role: string;
}

export interface ProjectAssignmentResult {
  page: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
  totalPages: number;
  items: ProjectAssignmentItem[];
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  private readonly http = inject(HttpClient);

  getProjects(params: {
    start?: number;
    length?: number;
    search?: string;
    sortColumn?: string;
    sortDirection?: string;
    status?: string;
  } = {}): Observable<ProjectListResult> {
    const normalizedParams = this.normalizeParams(params);

    let httpParams = new HttpParams();

    Object.entries(normalizedParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.http.get<ProjectListResult>(this.baseUrl, { params: httpParams, withCredentials: true });
  }

  private normalizeParams(params: { start?: number; length?: number; search?: string; sortColumn?: string; sortDirection?: string; status?: string }): Record<string, string | number | undefined> {
    const normalized: Record<string, string | number | undefined> = { ...params };
    const sortColumn = normalized['sortColumn'];
    if (typeof sortColumn === 'string' && sortColumn.trim()) {
      normalized['sortColumn'] = this.normalizeSortColumn(sortColumn);
    }

    const status = normalized['status'];
    if (typeof status === 'string' && status.trim()) {
      normalized['status'] = this.normalizeStatus(status);
    }

    return normalized;
  }

  private normalizeSortColumn(column: string): string {
    switch (column.trim().toLowerCase()) {
      case 'name':
        return 'Name';
      case 'createdat':
        return 'CreatedAt';
      case 'updatedat':
        return 'UpdatedAt';
      case 'startdate':
        return 'StartDate';
      case 'enddate':
        return 'EndDate';
      default:
        return column;
    }
  }

  private normalizeStatus(status: string): string {
    switch (status.trim().toLowerCase()) {
      case 'archived':
      case 'active':
      case 'planned':
      case 'completed':
      case 'all':
        return status.trim();
      default:
        return status.trim();
    }
  }

  clearListCache(): void {
    // This service no longer caches list responses. Keeping the hook for compatibility with auth/session resets.
  }

  getProject(id: number): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  createProject(payload: ProjectCreateRequest): Observable<ProjectDetail> {
    this.clearListCache();
    return this.http.post<ProjectDetail>(this.baseUrl, payload, { withCredentials: true });
  }

  updateProject(id: number, payload: ProjectCreateRequest): Observable<ProjectDetail> {
    this.clearListCache();
    return this.http.put<ProjectDetail>(`${this.baseUrl}/${id}`, payload, { withCredentials: true });
  }

  deleteProject(id: number): Observable<void> {
    this.clearListCache();
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  getMembers(projectId: number): Observable<ProjectItemMember[]> {
    return this.http.get<ProjectItemMember[]>(`${this.baseUrl}/${projectId}/members`, { withCredentials: true });
  }

  getAssignments(params: {
    start?: number;
    length?: number;
    search?: string;
    role?: string;
    projectId?: number;
  } = {}): Observable<ProjectAssignmentResult> {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.http.get<ProjectAssignmentResult>(`${this.baseUrl}/assignments`, { params: httpParams, withCredentials: true });
  }

  assignMember(projectId: number, payload: ProjectMemberAssignment): Observable<{ projectId: number; userId: number; role: string }> {
    return this.http.post<{ projectId: number; userId: number; role: string }>(`${this.baseUrl}/${projectId}/members`, payload, { withCredentials: true });
  }

  removeMember(projectId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${projectId}/members/${userId}`, { withCredentials: true });
  }
}
