import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ProjectDetail, ProjectItemMember, ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-project-form-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-form.page.html',
  styleUrls: ['./project-form.page.scss'],
})
export class ProjectFormPage implements OnInit {
  projectId: number | null = null;
  isEditMode = false;
  isSubmitting = false;
  canManageMembers = false;
  project: ProjectDetail | null = null;
  members: ProjectItemMember[] = [];
  memberForm = {
    userId: '',
    role: 'Member',
  };
  allowedRoles = ['Member', 'Manager'];

  form = {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    isArchived: false,
  };

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role ?? '';
    if (role === 'Admin') {
      this.allowedRoles = ['Manager', 'Member'];
    }
    if (role === 'Project Manager') {
      this.allowedRoles = ['Member'];
    }

    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId) {
      this.projectId = Number(routeId);
      this.isEditMode = true;
      this.loadProject();
    }
  }

  loadProject(): void {
    if (!this.projectId) {
      return;
    }

    this.projectService
      .getProject(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((project) => {
        this.project = project;
        this.form = {
          name: project.name,
          description: project.description ?? '',
          startDate: project.startDate ?? '',
          endDate: project.endDate ?? '',
          isArchived: false,
        };
        this.members = project.members ?? [];
        this.canManageMembers = project.canEdit;
      });
  }

  saveProject(): void {
    this.isSubmitting = true;

    const payload = {
      name: this.form.name,
      description: this.form.description || null,
      startDate: this.form.startDate || null,
      endDate: this.form.endDate || null,
      isArchived: this.form.isArchived,
    };

    const request$ = this.isEditMode && this.projectId
      ? this.projectService.updateProject(this.projectId, payload)
      : this.projectService.createProject(payload);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.isSubmitting = false;
          this.router.navigate(['/projects', project.id]);
        },
        error: () => {
          this.isSubmitting = false;
        },
      });
  }

  assignMember(): void {
    if (!this.projectId || !this.memberForm.userId) {
      return;
    }

    this.projectService
      .assignMember(this.projectId, {
        userId: Number(this.memberForm.userId),
        role: this.memberForm.role as 'Owner' | 'Manager' | 'Member' | 'Viewer',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.memberForm.userId = '';
        this.memberForm.role = this.allowedRoles[0] ?? 'Member';
        this.loadProject();
      });
  }

  removeMember(userId: number): void {
    if (!this.projectId) {
      return;
    }

    this.projectService
      .removeMember(this.projectId, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadProject();
      });
  }

  deleteProject(): void {
    if (!this.projectId || !this.project?.canDelete) {
      return;
    }

    const confirmed = window.confirm('Delete this project?');
    if (!confirmed) {
      return;
    }

    this.projectService
      .deleteProject(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.router.navigate(['/projects']);
      });
  }

  back(): void {
    this.router.navigate(['/projects']);
  }
}
