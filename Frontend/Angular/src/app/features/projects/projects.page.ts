import { CommonModule } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ProjectListItem, ProjectListResult, ProjectService } from '../../core/services/project.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './projects.page.html',
  styleUrls: ['./projects.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly rawSearch = signal('');
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly search = toSignal(
    toObservable(this.rawSearch).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );
  readonly sortColumn = signal('CreatedAt');
  readonly sortDirection = signal('desc');
  readonly statusFilter = signal('all');
  readonly canCreateProject: boolean;

  readonly queryParams = computed(() => {
    const params = {
      start: (this.page() - 1) * this.pageSize,
      length: this.pageSize,
      search: this.search().trim() || undefined,
      sortColumn: this.sortColumn() || undefined,
      sortDirection: this.sortDirection() || undefined,
      status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
    };

    const normalized = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'),
    ) as Record<string, string | number | boolean>;

    return normalized;
  });

  readonly projectsResource = httpResource<ProjectListResult>(() => ({
    url: `${environment.apiBaseUrl}/projects`,
    params: this.queryParams() as Record<string, string | number | boolean>,
    withCredentials: true,
  }));

  readonly projects = computed(() => this.projectsResource.value()?.items ?? []);
  readonly totalCount = computed(() => this.projectsResource.value()?.totalCount ?? 0);
  readonly totalPages = computed(() => this.projectsResource.value()?.totalPages || 1);
  readonly isLoading = this.projectsResource.isLoading;

  readonly currentUserRole = computed(() => this.authService.currentUser()?.role ?? 'Team Member');

  constructor() {
    this.canCreateProject =
      this.authService.currentUser()?.role === 'Admin' || this.authService.currentUser()?.role === 'Project Manager';

    effect(() => {
      this.search();
      this.statusFilter();
      this.sortColumn();
      this.sortDirection();

      untracked(() => {
        if (this.page() !== 1) {
          this.page.set(1);
        }
      });
    });
  }

  onSearchInput(): void {
    this.rawSearch.set(this.rawSearch().trim());
  }

  onSearch(): void {
    this.rawSearch.set(this.rawSearch().trim());
  }

  onSortChange(): void {
    this.page.set(1);
  }

  goToNewProject(): void {
    this.router.navigateByUrl('/projects/new');
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
}
