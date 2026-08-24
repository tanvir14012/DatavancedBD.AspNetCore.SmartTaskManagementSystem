import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  constructor(private readonly http: HttpClient) {}

  getProjects(params: {
    start?: number;
    length?: number;
    search?: string;
    sortColumn?: string;
    sortDirection?: string;
    status?: string;
  } = {}): Observable<ProjectListResult> {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.http.get<ProjectListResult>(this.baseUrl, { params: httpParams, withCredentials: true });
  }

  getProject(id: number): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  createProject(payload: ProjectCreateRequest): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(this.baseUrl, payload, { withCredentials: true });
  }

  updateProject(id: number, payload: ProjectCreateRequest): Observable<ProjectDetail> {
    return this.http.put<ProjectDetail>(`${this.baseUrl}/${id}`, payload, { withCredentials: true });
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  getMembers(projectId: number): Observable<ProjectItemMember[]> {
    return this.http.get<ProjectItemMember[]>(`${this.baseUrl}/${projectId}/members`, { withCredentials: true });
  }

  assignMember(projectId: number, payload: ProjectMemberAssignment): Observable<{ projectId: number; userId: number; role: string }> {
    return this.http.post<{ projectId: number; userId: number; role: string }>(`${this.baseUrl}/${projectId}/members`, payload, { withCredentials: true });
  }

  removeMember(projectId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${projectId}/members/${userId}`, { withCredentials: true });
  }
}
