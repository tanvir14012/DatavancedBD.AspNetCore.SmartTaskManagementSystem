import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectListItem, ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './projects.page.html',
  styleUrls: ['./projects.page.scss'],
})
export class ProjectsPage implements OnInit {
  projects: ProjectListItem[] = [];
  page = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;
  search = '';
  sortColumn = 'CreatedAt';
  sortDirection = 'desc';
  statusFilter = 'all';
  readonly canCreateProject: boolean;

  constructor(
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    const role = this.authService.currentUser()?.role ?? 'Team Member';
    this.canCreateProject = role === 'Admin' || role === 'Project Manager';
  }

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.projectService
      .getProjects({
        start: (this.page - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search,
        sortColumn: this.sortColumn,
        sortDirection: this.sortDirection,
        status: this.statusFilter,
      })
      .subscribe((result) => {
        this.projects = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = result.totalPages || 1;
        this.page = Math.min(this.page, this.totalPages || 1);
      });
  }

  onSearch(): void {
    this.page = 1;
    this.loadProjects();
  }

  onSortChange(): void {
    this.page = 1;
    this.loadProjects();
  }

  goToNewProject(): void {
    this.router.navigateByUrl('/projects/new');
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadProjects();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.loadProjects();
    }
  }

  get currentUserRole(): string {
    return this.authService.currentUser()?.role ?? 'Team Member';
  }
}
