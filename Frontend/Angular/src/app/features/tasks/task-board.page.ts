import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
})
export class TaskBoardPage implements OnInit {
  columns: TaskBoardColumn[] = [];
  projects: Array<{ id: number; name: string }> = [];

  projectFilter = 'all';
  priorityFilter = 'all';
  search = '';
  isLoading = false;
  canAccessBoard = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  constructor(
    private readonly taskService: TaskService,
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role ?? '';
    this.canAccessBoard = role === 'Admin' || role === 'Project Manager';

    if (!this.canAccessBoard) {
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
      this.projects = result.items.map((project) => ({ id: project.id, name: project.name }));
    });
  }

  loadBoard(): void {
    this.isLoading = true;

    this.taskService
      .board({
        projectId: this.projectFilter === 'all' ? undefined : Number(this.projectFilter),
        priority: this.priorityFilter === 'all' ? undefined : this.priorityFilter,
        search: this.search.trim() || undefined,
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => {
          this.columns = result.columns;
        },
        error: () => {
          this.columns = [];
        },
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.search.trim());
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
