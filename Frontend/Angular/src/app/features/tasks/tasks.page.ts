import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskListItem, TaskService } from '../../core/services/task.service';
import { UserService } from '../../core/services/user.service';

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
  readonly projectMembers = signal<Array<{ userId: string; userName: string; email: string }>>([]);
  readonly allUsers = signal<Array<{ id: number; firstName: string; lastName: string; email: string }>>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly search = signal('');
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
  readonly isLoading = signal(false);
  readonly loadingMembers = signal(false);
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

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  constructor(
    private readonly taskService: TaskService,
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
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
    this.loadUsers();
    this.loadTasks();
  }

  syncRoleFlags(): void {
    const role = this.authService.currentUser()?.role ?? '';
    this.isAdmin.set(role === 'Admin');
    this.isProjectManager.set(role === 'Project Manager');
    this.canCreateTask.set(role === 'Admin' || role === 'Project Manager');
  }

  readonly Object = Object;

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
        this.projectMembers.set(members.map(m => ({
          userId: String(m.userId),
          userName: m.userName,
          email: m.email
        })));
        this.loadingMembers.set(false);
      },
      error: () => {
        this.projectMembers.set([]);
        this.loadingMembers.set(false);
      }
    });
  }

  loadUsers(): void {
    this.userService.list({ start: 0, length: 500, status: 'all' }).subscribe({
      next: (result) => {
        this.allUsers.set(result.items.map(u => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email
        })));
      },
      error: () => {
        this.allUsers.set([]);
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
        assigneeId: this.assigneeFilter() === 'all' ? undefined : this.assigneeFilter(),
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

    if (!currentForm.projectId) {
      errors['projectId'] = 'Project is required.';
    }

    if (!currentForm.title.trim()) {
      errors['title'] = 'Title is required.';
    } else if (currentForm.title.trim().length > 200) {
      errors['title'] = 'Title must be less than 200 characters.';
    }

    if (currentForm.description && currentForm.description.trim().length > 2000) {
      errors['description'] = 'Description must be less than 2000 characters.';
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
