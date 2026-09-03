import { CommonModule } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProjectListResult, ProjectService } from '../../core/services/project.service';
import { TaskBoardCard, TaskBoardResult, TaskService } from '../../core/services/task.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-task-board-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './task-board.page.html',
  styleUrls: ['./task-board.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskBoardPage {
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly rawSearch = signal('');
  readonly projectFilter = signal('all');
  readonly priorityFilter = signal('all');
  readonly canAccessBoard: boolean;
  readonly search = toSignal(toObservable(this.rawSearch).pipe(debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });

  readonly queryParams = computed(() => {
    const params = {
      projectId: this.projectFilter() === 'all' ? undefined : Number(this.projectFilter()),
      priority: this.priorityFilter() === 'all' ? undefined : this.priorityFilter(),
      search: this.search().trim() || undefined,
    };

    const normalized = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'),
    ) as Record<string, string | number | boolean>;

    return normalized;
  });

  readonly projectsResource = httpResource<ProjectListResult>(() => ({
    url: `${environment.apiBaseUrl}/projects`,
    params: { start: 0, length: 200 } as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly boardResource = httpResource<TaskBoardResult>(() => ({
    url: `${environment.apiBaseUrl}/tasks/board`,
    params: this.queryParams() as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly projects = computed(() => this.projectsResource.value()?.items.map((project) => ({ id: project.id, name: project.name })) ?? []);
  readonly columns = computed(() => this.boardResource.value()?.columns ?? []);
  readonly isLoading = this.boardResource.isLoading;

  constructor() {
    this.canAccessBoard =
      this.authService.currentUser()?.role === 'Admin' || this.authService.currentUser()?.role === 'Project Manager';

    effect(() => {
      if (!this.canAccessBoard) {
        this.router.navigateByUrl('/tasks');
      }
    });
  }

  loadBoard(): void {
    this.boardResource.reload();
  }

  updateTaskStatus(task: TaskBoardCard, status: string): void {
    if (!task.canEdit || !status) {
      return;
    }

    this.taskService
      .update(task.id, {
        projectId: task.projectId,
        title: task.title,
        description: task.description ?? null,
        status,
        priority: task.priority,
        dueDate: task.dueDate ?? null,
      })
      .subscribe(() => this.boardResource.reload());
  }

  statusLabel(status: string): string {
    return status.replace(/([A-Z])/g, ' $1').trim();
  }

  statusClass(status: string): string {
    return status.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  priorityLabel(priority: string): string {
    return priority.replace(/([A-Z])/g, ' $1').trim();
  }

  priorityClass(priority: string): string {
    return priority.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
