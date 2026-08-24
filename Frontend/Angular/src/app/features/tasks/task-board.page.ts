import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskBoardCard, TaskBoardColumn, TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-task-board-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './task-board.page.html',
  styleUrls: ['./task-board.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskBoardPage implements OnInit {
  readonly columns = signal<TaskBoardColumn[]>([]);
  readonly projects = signal<Array<{ id: number; name: string }>>([]);
  readonly projectFilter = signal('all');
  readonly priorityFilter = signal('all');
  readonly search = signal('');
  readonly isLoading = signal(false);
  readonly canAccessBoard = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role ?? '';
    const hasAccess = role === 'Admin' || role === 'Project Manager';
    this.canAccessBoard.set(hasAccess);

    if (!hasAccess) {
      this.router.navigateByUrl('/tasks');
      return;
    }

    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadBoard());

    this.loadProjects();
    this.loadBoard();
  }

  loadProjects(): void {
    this.projectService.getProjects({ start: 0, length: 200 }).subscribe((result) => {
      this.projects.set(result.items.map((project) => ({ id: project.id, name: project.name })));
    });
  }

  loadBoard(): void {
    this.isLoading.set(true);

    this.taskService
      .board({
        projectId: this.projectFilter() === 'all' ? undefined : Number(this.projectFilter()),
        priority: this.priorityFilter() === 'all' ? undefined : this.priorityFilter(),
        search: this.search().trim() || undefined,
      })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          this.columns.set(result.columns);
        },
        error: () => {
          this.columns.set([]);
        },
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.search().trim());
  }

  updateTaskStatus(task: TaskBoardCard, status: string): void {
    if (!task.canEdit || !status) {
      return;
    }

    this.taskService
      .update(task.id, {
        projectId: task.projectId,
        title: task.title,
        description: task.description ?? null,
        status,
        priority: task.priority,
        dueDate: task.dueDate ?? null,
      })
      .subscribe(() => this.loadBoard());
  }

  statusLabel(status: string): string {
    return status.replace(/([A-Z])/g, ' $1').trim();
  }

  statusClass(status: string): string {
    return status.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  priorityLabel(priority: string): string {
    return priority.replace(/([A-Z])/g, ' $1').trim();
  }

  priorityClass(priority: string): string {
    return priority.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
