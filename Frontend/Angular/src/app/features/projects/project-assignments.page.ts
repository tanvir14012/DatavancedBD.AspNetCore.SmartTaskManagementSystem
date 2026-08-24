import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
})
export class ProjectAssignmentsPage implements OnInit {
  assignments: ProjectAssignmentItem[] = [];
  projects: ProjectListItem[] = [];
  users: UserListItem[] = [];
  page = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;
  search = '';
  roleFilter = 'all';
  projectFilter = 'all';
  selectedProjectId: number | null = null;
  selectedUserId: number | null = null;
  selectedRole = 'Member';
  isLoading = false;
  isSubmitting = false;
  isAdmin = false;
  allowedRoles = ['Member', 'Viewer'];

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  constructor(
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.currentUser()?.role === 'Admin';
    this.allowedRoles = this.isAdmin ? ['Owner', 'Manager', 'Member', 'Viewer'] : ['Member', 'Viewer'];
    this.selectedRole = this.allowedRoles[0] ?? 'Member';

    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page = 1;
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
          this.projects = result.items;
          if (!this.selectedProjectId && this.projects.length > 0) {
            this.selectedProjectId = this.projects[0].id;
          }
          if (this.projectFilter !== 'all' && !this.projects.some((project) => project.id === Number(this.projectFilter))) {
            this.projectFilter = 'all';
          }
        },
        error: () => {
          this.projects = [];
        },
      });
  }

  loadUsers(): void {
    this.userService
      .list({ start: 0, length: 250 })
      .subscribe({
        next: (result) => {
          this.users = result.items;
          if (!this.selectedUserId && this.users.length > 0) {
            this.selectedUserId = this.users[0].id;
          }
        },
        error: () => {
          this.users = [];
        },
      });
  }

  loadAssignments(): void {
    this.isLoading = true;
    const projectId = this.projectFilter === 'all' ? undefined : Number(this.projectFilter);

    this.projectService
      .getAssignments({
        start: (this.page - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search.trim() || undefined,
        role: this.roleFilter,
        projectId,
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => {
          this.assignments = result.items;
          this.totalCount = result.totalCount;
          this.totalPages = result.totalPages || 1;
          this.page = Math.min(this.page, this.totalPages || 1);
        },
        error: () => {
          this.assignments = [];
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
    this.loadAssignments();
  }

  assignMember(): void {
    if (!this.selectedProjectId || !this.selectedUserId) {
      return;
    }

    this.isSubmitting = true;
    this.projectService
      .assignMember(this.selectedProjectId, {
        userId: this.selectedUserId,
        role: this.selectedRole as 'Owner' | 'Manager' | 'Member' | 'Viewer',
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.selectedUserId = this.users.find((user) => user.id !== this.selectedUserId)?.id ?? null;
          this.selectedRole = this.allowedRoles[0] ?? 'Member';
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
    if (this.page > 1) {
      this.page -= 1;
      this.loadAssignments();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.loadAssignments();
    }
  }

  getProjectName(projectId: number): string {
    const project = this.projects.find((item) => item.id === projectId);
    return project?.name ?? `Project #${projectId}`;
  }

  getUserName(userId: number): string {
    const user = this.users.find((item) => item.id === userId);
    return user ? `${user.firstName} ${user.lastName}`.trim() : `User #${userId}`;
  }
}
