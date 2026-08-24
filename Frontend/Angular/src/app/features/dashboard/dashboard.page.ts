import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly statusBreakdown = computed(() => this.summary()?.statusBreakdown ?? []);
  readonly priorityBreakdown = computed(() => this.summary()?.priorityBreakdown ?? []);
  readonly urgentTasks = computed(() => this.summary()?.urgentTasks ?? []);
  readonly completionRate = computed(() => {
    const summary = this.summary();
    if (!summary || summary.totalTasks === 0) return 0;
    return Math.round((summary.completedTasks / summary.totalTasks) * 100);
  });

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(forceReload = false): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.dashboardService
      .getSummary(undefined, forceReload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.summary.set(data);
        },
        error: () => {
          this.errorMessage.set('Unable to load dashboard details from the server.');
        },
      });
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
}
