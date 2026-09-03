import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TaskListItem {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface TaskListResult {
  page: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
  totalPages: number;
  items: TaskListItem[];
}

export interface TaskDetail {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface TaskBoardCard {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignees: string[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface TaskBoardColumn {
  status: string;
  title: string;
  taskCount: number;
  tasks: TaskBoardCard[];
}

export interface TaskBoardResult {
  totalCount: number;
  columns: TaskBoardColumn[];
}

export interface TaskCreateRequest {
  projectId: number;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeEmail?: string | null;
}

export interface TaskUpdateRequest {
  projectId?: number;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tasks`;

  private readonly http = inject(HttpClient);

  clearListCache(): void {
    // This service no longer caches list responses. Keeping the hook for compatibility with auth/session resets.
  }

  list(params: {
    start?: number;
    length?: number;
    search?: string;
    projectId?: number;
    status?: string;
    priority?: string;
    assigneeId?: string;
    sortColumn?: string;
    sortDirection?: string;
  } = {}): Observable<TaskListResult> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([keyName, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(keyName, String(value));
      }
    });

    return this.http.get<TaskListResult>(this.baseUrl, { params: httpParams, withCredentials: true });
  }

  board(params: { projectId?: number; search?: string; priority?: string } = {}): Observable<TaskBoardResult> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([keyName, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(keyName, String(value));
      }
    });

    return this.http.get<TaskBoardResult>(`${this.baseUrl}/board`, { params: httpParams, withCredentials: true });
  }

  getTask(id: number): Observable<TaskDetail> {
    return this.http.get<TaskDetail>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  create(payload: TaskCreateRequest): Observable<TaskDetail> {
    this.clearListCache();
    return this.http.post<TaskDetail>(this.baseUrl, payload, { withCredentials: true });
  }

  update(id: number, payload: TaskUpdateRequest): Observable<TaskDetail> {
    this.clearListCache();
    return this.http.put<TaskDetail>(`${this.baseUrl}/${id}`, payload, { withCredentials: true });
  }

  delete(id: number): Observable<{ success: boolean; id: number }> {
    this.clearListCache();
    return this.http.delete<{ success: boolean; id: number }>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  assignUser(id: number, payload: { userId?: string; email?: string }): Observable<{ message: string; userId: string; taskId: number }> {
    this.clearListCache();
    return this.http.post<{ message: string; userId: string; taskId: number }>(`${this.baseUrl}/${id}/assign`, payload, { withCredentials: true });
  }

  unassignUser(id: number, userId: string): Observable<{ message: string; userId: string; taskId: number }> {
    this.clearListCache();
    return this.http.delete<{ message: string; userId: string; taskId: number }>(`${this.baseUrl}/${id}/assign/${userId}`, { withCredentials: true });
  }

  improveDescription(description: string): Observable<{ improved: string }> {
    return this.http.post<{ improved: string }>(`${environment.apiBaseUrl}/ai/improve-description`, { text: description }, { withCredentials: true });
  }
}
