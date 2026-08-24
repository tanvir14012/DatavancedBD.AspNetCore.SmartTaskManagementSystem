import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
})
export class TasksPage implements OnInit {
  tasks: TaskListItem[] = [];
  projects: Array<{ id: number; name: string }> = [];

  page = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;

  search = '';
  projectFilter = 'all';
  statusFilter = 'all';
  priorityFilter = 'all';
  sortColumn = 'CreatedAt';
  sortDirection = 'desc';

  isAdmin = false;
  isProjectManager = false;
  canCreateTask = false;
  showForm = false;
  editingTaskId: number | null = null;
  isLoading = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  form = {
    projectId: '',
    title: '',
    description: '',
    status: 'Todo',
    priority: 'Medium',
    dueDate: '',
  };

  constructor(
    private readonly taskService: TaskService,
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.syncRoleFlags();
    this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.page = 1;
        this.loadTasks();
      });

    this.loadProjects();
    this.loadTasks();
  }

  syncRoleFlags(): void {
    const role = this.authService.currentUser()?.role ?? '';
    this.isAdmin = role === 'Admin';
    this.isProjectManager = role === 'Project Manager';
    this.canCreateTask = this.isAdmin || this.isProjectManager;
  }

  loadProjects(): void {
    this.projectService
      .getProjects({ start: 0, length: 200, status: 'all' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.projects = result.items.map((project) => ({ id: project.id, name: project.name }));
        if (this.projects.length > 0 && !this.form.projectId) {
          this.form.projectId = String(this.projects[0].id);
        }
      });
  }

  loadTasks(): void {
    this.isLoading = true;

    this.taskService
      .list({
        start: (this.page - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search.trim() || undefined,
        projectId: this.projectFilter === 'all' ? undefined : Number(this.projectFilter),
        status: this.statusFilter === 'all' ? undefined : this.statusFilter,
        priority: this.priorityFilter === 'all' ? undefined : this.priorityFilter,
        sortColumn: this.sortColumn,
        sortDirection: this.sortDirection,
      })
      .pipe(
        finalize(() => (this.isLoading = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.tasks = result.items;
          this.totalCount = result.totalCount;
          this.totalPages = result.totalPages || 1;
          this.page = Math.min(this.page, this.totalPages || 1);
        },
        error: () => {
          this.tasks = [];
          this.totalCount = 0;
          this.totalPages = 1;
        },
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.search.trim());
  }

  onSearch(): void {
    this.searchSubject.next(this.search.trim());
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadTasks();
  }

  openCreateForm(): void {
    this.editingTaskId = null;
    this.form = {
      projectId: this.projects[0] ? String(this.projects[0].id) : '',
      title: '',
      description: '',
      status: 'Todo',
      priority: 'Medium',
      dueDate: '',
    };
    this.showForm = true;
  }

  openEditForm(task: TaskListItem): void {
    this.editingTaskId = task.id;
    this.form = {
      projectId: String(task.projectId),
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? '',
    };
    this.showForm = true;
  }

  submitForm(): void {
    if (!this.form.title.trim() || !this.form.projectId) {
      return;
    }

    const payload = {
      projectId: Number(this.form.projectId),
      title: this.form.title.trim(),
      description: this.form.description.trim() || null,
      status: this.form.status,
      priority: this.form.priority,
      dueDate: this.form.dueDate || null,
    };

    const request$ = this.editingTaskId === null
      ? this.taskService.create(payload)
      : this.taskService.update(this.editingTaskId, payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.showForm = false;
      this.loadTasks();
    });
  }

  deleteTask(id: number): void {
    if (!window.confirm('Delete this task?')) {
      return;
    }

    this.taskService.delete(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadTasks();
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadTasks();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
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
