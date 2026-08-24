import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly cdr = inject(ChangeDetectorRef);

  summary: DashboardSummary | null = null;
  isLoading = true;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(forceReload = false): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.dashboardService
      .getSummary(undefined, forceReload)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (data) => {
          this.summary = data;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Unable to load dashboard details from the server.';
          this.cdr.markForCheck();
        },
      });
  }

  get statusBreakdown(): Array<{ key: string; value: number }> {
    return this.summary?.statusBreakdown ?? [];
  }

  get priorityBreakdown(): Array<{ key: string; value: number }> {
    return this.summary?.priorityBreakdown ?? [];
  }

  get urgentTasks() {
    return this.summary?.urgentTasks ?? [];
  }

  formatLabel(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'No due date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No due date';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  getCompletionRate(): number {
    if (!this.summary || this.summary.totalTasks === 0) {
      return 0;
    }

    return Math.round((this.summary.completedTasks / this.summary.totalTasks) * 100);
  }
}
