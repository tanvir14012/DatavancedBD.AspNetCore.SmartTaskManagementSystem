import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ProjectListItem, ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './projects.page.html',
  styleUrls: ['./projects.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage implements OnInit {
  readonly projects = signal<ProjectListItem[]>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly search = signal('');
  readonly sortColumn = signal('CreatedAt');
  readonly sortDirection = signal('desc');
  readonly statusFilter = signal('all');
  readonly isLoading = signal(false);
  readonly canCreateProject: boolean;

  readonly currentUserRole = computed(() => this.authService.currentUser()?.role ?? 'Team Member');

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  constructor(
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    const role = this.authService.currentUser()?.role ?? 'Team Member';
    this.canCreateProject = role === 'Admin' || role === 'Project Manager';
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.loadProjects();
      });

    this.loadProjects();
  }

  loadProjects(): void {
    this.isLoading.set(true);

    this.projectService
      .getProjects({
        start: (this.page() - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search().trim() || undefined,
        sortColumn: this.sortColumn(),
        sortDirection: this.sortDirection(),
        status: this.statusFilter(),
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.projects.set(result.items);
          this.totalCount.set(result.totalCount);
          this.totalPages.set(result.totalPages || 1);
          this.page.set(Math.min(this.page(), this.totalPages() || 1));
        },
        error: () => {
          this.projects.set([]);
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

  onSortChange(): void {
    this.page.set(1);
    this.loadProjects();
  }

  goToNewProject(): void {
    this.router.navigateByUrl('/projects/new');
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadProjects();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadProjects();
    }
  }
}
