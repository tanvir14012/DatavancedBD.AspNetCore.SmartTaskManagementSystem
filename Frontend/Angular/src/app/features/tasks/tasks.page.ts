import { CommonModule } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskListItem, TaskListResult, TaskService } from '../../core/services/task.service';
import { UserService } from '../../core/services/user.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.page.html',
  styleUrls: ['./tasks.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage {
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  readonly rawSearch = signal('');
  readonly tasks = signal<TaskListItem[]>([]);
  readonly projects = signal<Array<{ id: number; name: string }>>([]);
  readonly projectMembers = signal<Array<{ userId: string; userName: string; email: string }>>([]);
  readonly allUsers = signal<Array<{ id: number; firstName: string; lastName: string; email: string }>>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly search = toSignal(toObservable(this.rawSearch).pipe(debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });
  readonly projectFilter = signal('all');
  readonly statusFilter = signal('all');
  readonly priorityFilter = signal('all');
  readonly assigneeFilter = signal('all');
  readonly sortColumn = signal('CreatedAt');
  readonly sortDirection = signal('desc');
  readonly isAdmin = signal(false);
  readonly isProjectManager = signal(false);
  readonly canCreateTask = signal(false);
  readonly showForm = signal(false);
  readonly editingTaskId = signal<number | null>(null);
  readonly loadingMembers = signal(false);
  readonly improvingDescription = signal(false);
  readonly formErrors = signal<Record<string, string>>({});
  readonly form = {
    projectId: '',
    title: '',
    description: '',
    status: 'Todo',
    priority: 'Medium',
    dueDate: '',
    assigneeEmail: '',
  };

  readonly queryParams = computed(() => {
    const params = {
      start: (this.page() - 1) * this.pageSize,
      length: this.pageSize,
      search: this.search().trim() || undefined,
      projectId: this.projectFilter() === 'all' ? undefined : Number(this.projectFilter()),
      status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
      priority: this.priorityFilter() === 'all' ? undefined : this.priorityFilter(),
      assigneeId: this.assigneeFilter() === 'all' ? undefined : this.assigneeFilter(),
      sortColumn: this.sortColumn() || undefined,
      sortDirection: this.sortDirection() || undefined,
    };

    const normalized = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'),
    ) as Record<string, string | number | boolean>;

    return normalized;
  });

  readonly tasksResource = httpResource<TaskListResult>(() => ({
    url: `${environment.apiBaseUrl}/tasks`,
    params: this.queryParams() as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly isLoading = this.tasksResource.isLoading;
  readonly totalCount = computed(() => this.tasksResource.value()?.totalCount ?? 0);
  readonly totalPages = computed(() => this.tasksResource.value()?.totalPages || 1);

  readonly Object = Object;

  constructor() {
    effect(() => {
      this.syncRoleFlags();
      this.search();
      this.projectFilter();
      this.statusFilter();
      this.priorityFilter();
      this.assigneeFilter();
      this.sortColumn();
      this.sortDirection();

      untracked(() => {
        if (this.page() !== 1) {
          this.page.set(1);
        }
      });
    });

    effect(() => {
      this.tasks.set(this.tasksResource.value()?.items ?? []);
    });

    this.loadProjects();
    this.loadUsers();
  }

  syncRoleFlags(): void {
    const role = this.authService.currentUser()?.role ?? '';
    this.isAdmin.set(role === 'Admin');
    this.isProjectManager.set(role === 'Project Manager');
    this.canCreateTask.set(role === 'Admin' || role === 'Project Manager');
  }

  loadProjects(): void {
    this.projectService.getProjects({ start: 0, length: 200, status: 'all' }).subscribe((result) => {
      const projectsList = result.items.map((project) => ({ id: project.id, name: project.name }));
      this.projects.set(projectsList);
      if (projectsList.length > 0 && !this.form.projectId) {
        this.form.projectId = String(projectsList[0].id);
        this.loadProjectMembers(projectsList[0].id);
      }
    });
  }

  loadProjectMembers(projectId: number): void {
    this.loadingMembers.set(true);
    this.projectService.getMembers(projectId).subscribe({
      next: (members) => {
        members = members || [];
        this.projectMembers.set(
          members.map((m) => ({
            userId: String(m.userId),
            userName: m.userName,
            email: m.email,
          })),
        );
        this.loadingMembers.set(false);
      },
      error: () => {
        this.projectMembers.set([]);
        this.loadingMembers.set(false);
      },
    });
  }

  loadUsers(): void {
    this.userService.list({ start: 0, length: 500, status: 'all' }).subscribe({
      next: (result) => {
        this.allUsers.set(
          result.items.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
          })),
        );
      },
      error: () => {
        this.allUsers.set([]);
      },
    });
  }

  loadTasks(): void {
    this.tasksResource.reload();
    this.tasks.set(this.tasksResource.value()?.items ?? []);
  }

  onSearchInput(): void {
    this.rawSearch.set(this.rawSearch());
  }

  onSearch(): void {
    this.rawSearch.set(this.rawSearch());
  }

  onFilterChange(): void {
    this.page.set(1);
  }

  openCreateForm(): void {
    this.editingTaskId.set(null);
    this.form.projectId = this.projects()[0] ? String(this.projects()[0].id) : '';
    if (this.form.projectId) {
      this.loadProjectMembers(Number(this.form.projectId));
    }
    this.form.title = '';
    this.form.description = '';
    this.form.status = 'Todo';
    this.form.priority = 'Medium';
    this.form.dueDate = '';
    this.form.assigneeEmail = '';
    this.showForm.set(true);
  }

  onProjectChange(): void {
    if (this.form.projectId) {
      this.loadProjectMembers(Number(this.form.projectId));
    }
  }

  openEditForm(task: TaskListItem): void {
    this.editingTaskId.set(task.id);
    this.form.projectId = String(task.projectId);
    this.form.title = task.title;
    this.form.description = task.description ?? '';
    this.form.status = task.status;
    this.form.priority = task.priority;
    this.form.dueDate = task.dueDate ?? '';
    this.form.assigneeEmail = '';
    this.loadProjectMembers(task.projectId);
    this.showForm.set(true);
  }

  submitForm(): void {
    const currentForm = this.form;
    const errors: Record<string, string> = {};

    // Validate ProjectId
    if (!currentForm.projectId) {
      errors['projectId'] = 'Project is required.';
    }

    // Validate Title
    if (!currentForm.title.trim()) {
      errors['title'] = 'Task title is required.';
    } else if (currentForm.title.trim().length > 200) {
      errors['title'] = 'Task title cannot exceed 200 characters.';
    } else if (!/^[a-zA-Z0-9\s\-_.&():'""]+$/.test(currentForm.title)) {
      errors['title'] = 'Task title contains invalid characters.';
    }

    // Validate Description
    if (currentForm.description && currentForm.description.trim().length > 4000) {
      errors['description'] = 'Task description cannot exceed 4000 characters.';
    }

    // Validate Status
    const validStatuses = ['Todo', 'InProgress', 'Completed', 'Cancelled'];
    if (currentForm.status && !validStatuses.includes(currentForm.status)) {
      errors['status'] = 'Invalid task status.';
    }

    // Validate Priority
    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
    if (currentForm.priority && !validPriorities.includes(currentForm.priority)) {
      errors['priority'] = 'Invalid task priority.';
    }

    // Validate DueDate
    if (currentForm.dueDate) {
      const dueDate = new Date(currentForm.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        errors['dueDate'] = 'Due date cannot be in the past.';
      }
    }

    // Validate AssigneeEmail
    if (currentForm.assigneeEmail) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(currentForm.assigneeEmail)) {
        errors['assigneeEmail'] = 'Assignee email must be a valid email address.';
      }
    }

    this.formErrors.set(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = {
      projectId: Number(currentForm.projectId),
      title: currentForm.title.trim(),
      description: currentForm.description.trim() || null,
      status: currentForm.status,
      priority: currentForm.priority,
      dueDate: currentForm.dueDate || null,
      assigneeEmail: currentForm.assigneeEmail?.trim() || null,
    };

    const editingId = this.editingTaskId();
    const request$ = editingId === null
      ? this.taskService.create(payload)
      : this.taskService.update(editingId, payload);

    request$.subscribe(() => {
      this.showForm.set(false);
      this.formErrors.set({});
      this.tasksResource.reload();
    });
  }

  deleteTask(id: number): void {
    if (!window.confirm('Delete this task?')) {
      return;
    }

    this.taskService.delete(id).subscribe(() => {
      this.tasksResource.reload();
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  formatStatus(value: string): string {
    return value.replace(/([A-Z])/g, ' $1').trim();
  }

  statusCssClass(value: string): string {
    return value.toLowerCase().replace(/\s+/g, '-');
  }

  formatPriority(value: string): string {
    return value.replace(/([A-Z])/g, ' $1').trim();
  }

  priorityCssClass(value: string): string {
    return value.toLowerCase();
  }

  improveDescription(): void {
    if (!this.form.description.trim()) {
      alert('Please enter a description to improve.');
      return;
    }

    this.improvingDescription.set(true);
    this.taskService.improveDescription(this.form.description).subscribe({
      next: (result) => {
        this.form.description = result.improved;
        this.improvingDescription.set(false);
      },
      error: () => {
        alert('Failed to improve description. Please try again.');
        this.improvingDescription.set(false);
      }
    });
  }
}
