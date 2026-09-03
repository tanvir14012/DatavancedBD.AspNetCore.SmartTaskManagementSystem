import { CommonModule } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProjectAssignmentItem, ProjectAssignmentResult, ProjectListItem, ProjectListResult, ProjectService } from '../../core/services/project.service';
import { UserListItem, UserListResult, UserService } from '../../core/services/user.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-project-assignments-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-assignments.page.html',
  styleUrls: ['./project-assignments.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAssignmentsPage {
  private readonly projectService = inject(ProjectService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  readonly rawSearch = signal('');
  readonly assignments = computed(() => this.assignmentsResource.value()?.items ?? []);
  readonly projects = computed(() => this.projectsResource.value()?.items ?? []);
  readonly users = computed(() => this.usersResource.value()?.items ?? []);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly search = toSignal(toObservable(this.rawSearch).pipe(debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });
  readonly roleFilter = signal('all');
  readonly projectFilter = signal('all');
  readonly selectedProjectId = signal<number | null>(null);
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedRole = signal('Member');
  readonly isSubmitting = signal(false);
  readonly isAdmin = signal(false);
  readonly allowedRoles = signal(['Member', 'Viewer']);

  readonly assignmentsQuery = computed(() => {
    const params = {
      start: (this.page() - 1) * this.pageSize,
      length: this.pageSize,
      search: this.search().trim() || undefined,
      role: this.roleFilter() === 'all' ? undefined : this.roleFilter(),
      projectId: this.projectFilter() === 'all' ? undefined : Number(this.projectFilter()),
    };

    const normalized = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'),
    ) as Record<string, string | number | boolean>;

    return normalized;
  });

  readonly assignmentsResource = httpResource<ProjectAssignmentResult>(() => ({
    url: `${environment.apiBaseUrl}/projects/assignments`,
    params: this.assignmentsQuery() as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly projectsResource = httpResource<ProjectListResult>(() => ({
    url: `${environment.apiBaseUrl}/projects`,
    params: { start: 0, length: 200 } as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly usersResource = httpResource<UserListResult>(() => ({
    url: `${environment.apiBaseUrl}/users`,
    params: { start: 0, length: 250 } as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly isLoading = this.assignmentsResource.isLoading;
  readonly totalCount = computed(() => this.assignmentsResource.value()?.totalCount ?? 0);
  readonly totalPages = computed(() => this.assignmentsResource.value()?.totalPages || 1);

  constructor() {
    effect(() => {
      const role = this.authService.currentUser()?.role ?? '';
      this.isAdmin.set(role === 'Admin');
      this.allowedRoles.set(this.isAdmin() ? ['Owner', 'Manager', 'Member', 'Viewer'] : ['Member', 'Viewer']);
      this.selectedRole.set(this.allowedRoles()[0] ?? 'Member');

      const projects = this.projects();
      if (!this.selectedProjectId() && projects.length > 0) {
        this.selectedProjectId.set(projects[0].id);
      }
      if (this.projectFilter() !== 'all' && !projects.some((project) => project.id === Number(this.projectFilter()))) {
        this.projectFilter.set('all');
      }

      const users = this.users();
      if (!this.selectedUserId() && users.length > 0) {
        this.selectedUserId.set(users[0].id);
      }
    });
  }

  onFilterChange(): void {
    this.page.set(1);
  }

  assignMember(): void {
    if (!this.selectedProjectId() || !this.selectedUserId()) {
      return;
    }

    this.isSubmitting.set(true);
    this.projectService
      .assignMember(this.selectedProjectId()!, {
        userId: this.selectedUserId()!,
        role: this.selectedRole() as 'Owner' | 'Manager' | 'Member' | 'Viewer',
      })
      .subscribe({
        next: () => {
          this.selectedUserId.set(
            this.users().find((user) => user.id !== this.selectedUserId())?.id ?? null,
          );
          this.selectedRole.set(this.allowedRoles()[0] ?? 'Member');
          this.isSubmitting.set(false);
          this.assignmentsResource.reload();
        },
        error: () => {
          this.isSubmitting.set(false);
          window.alert('The selected user could not be assigned to the project.');
        },
      });
  }

  removeAssignment(item: ProjectAssignmentItem): void {
    const confirmed = window.confirm(`Remove ${item.userName} from ${item.projectName}?`);
    if (!confirmed) {
      return;
    }

    this.projectService.removeMember(item.projectId, item.userId).subscribe({
      next: () => {
        this.assignmentsResource.reload();
      },
      error: () => {
        window.alert('Unable to remove this user from the project.');
      },
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

  getProjectName(projectId: number): string {
    const project = this.projects().find((item) => item.id === projectId);
    return project?.name ?? `Project #${projectId}`;
  }

  getUserName(userId: number): string {
    const user = this.users().find((item) => item.id === userId);
    return user ? `${user.firstName} ${user.lastName}`.trim() : `User #${userId}`;
  }
}
