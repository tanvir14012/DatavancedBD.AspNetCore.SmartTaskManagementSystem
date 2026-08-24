import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskListItem, TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.page.html',
  styleUrls: ['./tasks.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage implements OnInit {
  readonly tasks = signal<TaskListItem[]>([]);
  readonly projects = signal<Array<{ id: number; name: string }>>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly search = signal('');
  readonly projectFilter = signal('all');
  readonly statusFilter = signal('all');
  readonly priorityFilter = signal('all');
  readonly sortColumn = signal('CreatedAt');
  readonly sortDirection = signal('desc');
  readonly isAdmin = signal(false);
  readonly isProjectManager = signal(false);
  readonly canCreateTask = signal(false);
  readonly showForm = signal(false);
  readonly editingTaskId = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly form = {
    projectId: '',
    title: '',
    description: '',
    status: 'Todo',
    priority: 'Medium',
    dueDate: '',
  };

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  constructor(
    private readonly taskService: TaskService,
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.syncRoleFlags();
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.loadTasks();
      });

    this.loadProjects();
    this.loadTasks();
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
      }
    });
  }

  loadTasks(): void {
    this.isLoading.set(true);

    this.taskService
      .list({
        start: (this.page() - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search().trim() || undefined,
        projectId: this.projectFilter() === 'all' ? undefined : Number(this.projectFilter()),
        status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
        priority: this.priorityFilter() === 'all' ? undefined : this.priorityFilter(),
        sortColumn: this.sortColumn(),
        sortDirection: this.sortDirection(),
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.tasks.set(result.items);
          this.totalCount.set(result.totalCount);
          this.totalPages.set(result.totalPages || 1);
          this.page.set(Math.min(this.page(), this.totalPages() || 1));
        },
        error: () => {
          this.tasks.set([]);
          this.totalCount.set(0);
          this.totalPages.set(1);
        },
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.search().trim());
  }

  onSearch(): void {
    this.searchSubject.next(this.search().trim());
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadTasks();
  }

  openCreateForm(): void {
    this.editingTaskId.set(null);
    this.form.projectId = this.projects()[0] ? String(this.projects()[0].id) : '';
    this.form.title = '';
    this.form.description = '';
    this.form.status = 'Todo';
    this.form.priority = 'Medium';
    this.form.dueDate = '';
    this.showForm.set(true);
  }

  openEditForm(task: TaskListItem): void {
    this.editingTaskId.set(task.id);
    this.form.projectId = String(task.projectId);
    this.form.title = task.title;
    this.form.description = task.description ?? '';
    this.form.status = task.status;
    this.form.priority = task.priority;
    this.form.dueDate = task.dueDate ?? '';
    this.showForm.set(true);
  }

  submitForm(): void {
    const currentForm = this.form;
    if (!currentForm.title.trim() || !currentForm.projectId) {
      return;
    }

    const payload = {
      projectId: Number(currentForm.projectId),
      title: currentForm.title.trim(),
      description: currentForm.description.trim() || null,
      status: currentForm.status,
      priority: currentForm.priority,
      dueDate: currentForm.dueDate || null,
    };

    const editingId = this.editingTaskId();
    const request$ = editingId === null
      ? this.taskService.create(payload)
      : this.taskService.update(editingId, payload);

    request$.subscribe(() => {
      this.showForm.set(false);
      this.loadTasks();
    });
  }

  deleteTask(id: number): void {
    if (!window.confirm('Delete this task?')) {
      return;
    }

    this.taskService.delete(id).subscribe(() => {
      this.loadTasks();
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadTasks();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadTasks();
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
}
