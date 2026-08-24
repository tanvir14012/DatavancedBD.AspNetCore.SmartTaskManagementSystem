import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProjectAssignmentItem, ProjectListItem, ProjectService } from '../../core/services/project.service';
import { UserListItem, UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-project-assignments-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-assignments.page.html',
  styleUrls: ['./project-assignments.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAssignmentsPage implements OnInit {
  readonly assignments = signal<ProjectAssignmentItem[]>([]);
  readonly projects = signal<ProjectListItem[]>([]);
  readonly users = signal<UserListItem[]>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly search = signal('');
  readonly roleFilter = signal('all');
  readonly projectFilter = signal('all');
  readonly selectedProjectId = signal<number | null>(null);
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedRole = signal('Member');
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly isAdmin = signal(false);
  readonly allowedRoles = signal(['Member', 'Viewer']);

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();
  private readonly projectService = inject(ProjectService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role ?? '';
    this.isAdmin.set(role === 'Admin');
    this.allowedRoles.set(this.isAdmin() ? ['Owner', 'Manager', 'Member', 'Viewer'] : ['Member', 'Viewer']);
    this.selectedRole.set(this.allowedRoles()[0] ?? 'Member');

    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.loadAssignments();
      });

    this.loadProjects();
    this.loadUsers();
    this.loadAssignments();
  }

  loadProjects(): void {
    this.projectService
      .getProjects({ start: 0, length: 200 })
      .subscribe({
        next: (result) => {
          this.projects.set(result.items);
          if (!this.selectedProjectId() && result.items.length > 0) {
            this.selectedProjectId.set(result.items[0].id);
          }
          if (this.projectFilter() !== 'all' && !result.items.some((project) => project.id === Number(this.projectFilter()))) {
            this.projectFilter.set('all');
          }
        },
        error: () => {
          this.projects.set([]);
        },
      });
  }

  loadUsers(): void {
    this.userService
      .list({ start: 0, length: 250 })
      .subscribe({
        next: (result) => {
          this.users.set(result.items);
          if (!this.selectedUserId() && result.items.length > 0) {
            this.selectedUserId.set(result.items[0].id);
          }
        },
        error: () => {
          this.users.set([]);
        },
      });
  }

  loadAssignments(): void {
    this.isLoading.set(true);
    const projectId = this.projectFilter() === 'all' ? undefined : Number(this.projectFilter());

    this.projectService
      .getAssignments({
        start: (this.page() - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search().trim() || undefined,
        role: this.roleFilter(),
        projectId,
      })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          this.assignments.set(result.items);
          this.totalCount.set(result.totalCount);
          this.totalPages.set(result.totalPages || 1);
          this.page.set(Math.min(this.page(), this.totalPages() || 1));
        },
        error: () => {
          this.assignments.set([]);
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
    this.loadAssignments();
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
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.selectedUserId.set(
            this.users().find((user) => user.id !== this.selectedUserId())?.id ?? null,
          );
          this.selectedRole.set(this.allowedRoles()[0] ?? 'Member');
          this.loadAssignments();
        },
        error: () => {
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
        this.loadAssignments();
      },
      error: () => {
        window.alert('Unable to remove this user from the project.');
      },
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadAssignments();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadAssignments();
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
