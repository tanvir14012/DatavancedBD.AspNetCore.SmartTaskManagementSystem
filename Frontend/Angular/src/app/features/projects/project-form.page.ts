import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectDetail, ProjectItemMember, ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-project-form-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-form.page.html',
  styleUrls: ['./project-form.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormPage implements OnInit {
  readonly projectId = signal<number | null>(null);
  readonly isEditMode = signal(false);
  readonly isSubmitting = signal(false);
  readonly canManageMembers = signal(false);
  readonly project = signal<ProjectDetail | null>(null);
  readonly members = signal<ProjectItemMember[]>([]);
  readonly allowedRoles = signal(['Member', 'Manager']);
  readonly memberForm = {
    userId: '',
    role: 'Member',
  };
  readonly form = {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    isArchived: false,
  };

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role ?? '';
    if (role === 'Admin') {
      this.allowedRoles.set(['Owner', 'Manager', 'Member', 'Viewer']);
    } else if (role === 'Project Manager') {
      this.allowedRoles.set(['Manager', 'Member']);
    } else {
      this.allowedRoles.set(['Member']);
    }
    this.memberForm.role = this.allowedRoles()[0] ?? 'Member';

    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId) {
      this.projectId.set(Number(routeId));
      this.isEditMode.set(true);
      this.loadProject();
    }
  }

  loadProject(): void {
    const id = this.projectId();
    if (!id) {
      return;
    }

    this.projectService.getProject(id).subscribe((project) => {
      this.project.set(project);
      this.form.name = project.name;
      this.form.description = project.description ?? '';
      this.form.startDate = project.startDate ?? '';
      this.form.endDate = project.endDate ?? '';
      this.form.isArchived = false;
      this.members.set(project.members ?? []);
      this.canManageMembers.set(project.canEdit);
    });
  }

  saveProject(): void {
    this.isSubmitting.set(true);

    const payload = {
      name: this.form.name,
      description: this.form.description || null,
      startDate: this.form.startDate || null,
      endDate: this.form.endDate || null,
      isArchived: this.form.isArchived,
    };

    const id = this.projectId();
    const request$ = this.isEditMode() && id
      ? this.projectService.updateProject(id, payload)
      : this.projectService.createProject(payload);

    request$.subscribe({
      next: (project) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/projects', project.id]);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  assignMember(): void {
    const id = this.projectId();
    const userId = this.memberForm.userId;
    if (!id || !userId) {
      return;
    }

    this.projectService
      .assignMember(id, {
        userId: Number(userId),
        role: this.memberForm.role as 'Owner' | 'Manager' | 'Member' | 'Viewer',
      })
      .subscribe(() => {
        this.memberForm.userId = '';
        this.memberForm.role = this.allowedRoles()[0] ?? 'Member';
        this.loadProject();
      });
  }

  removeMember(userId: number): void {
    const id = this.projectId();
    if (!id) {
      return;
    }

    this.projectService.removeMember(id, userId).subscribe(() => {
      this.loadProject();
    });
  }

  deleteProject(): void {
    const id = this.projectId();
    const proj = this.project();
    if (!id || !proj?.canDelete) {
      return;
    }

    const confirmed = window.confirm('Delete this project?');
    if (!confirmed) {
      return;
    }

    this.projectService.deleteProject(id).subscribe(() => {
      this.router.navigate(['/projects']);
    });
  }

  back(): void {
    this.router.navigate(['/projects']);
  }
}
