import { CommonModule } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly dashboardService = inject(DashboardService);

  readonly summaryResource = httpResource<DashboardSummary>(() => ({
    url: `${environment.apiBaseUrl}/dashboard/summary`,
    withCredentials: true,
  }));

  readonly summary = computed(() => this.summaryResource.value() ?? null);
  readonly isLoading = this.summaryResource.isLoading;
  readonly errorMessage = computed(() =>
    this.summaryResource.error() ? 'Unable to load dashboard details from the server.' : null,
  );

  readonly statusBreakdown = computed(() => this.summary()?.statusBreakdown ?? []);
  readonly priorityBreakdown = computed(() => this.summary()?.priorityBreakdown ?? []);
  readonly urgentTasks = computed(() => this.summary()?.urgentTasks ?? []);
  readonly completionRate = computed(() => {
    const summary = this.summary();
    if (!summary || summary.totalTasks === 0) return 0;
    return Math.round((summary.completedTasks / summary.totalTasks) * 100);
  });

  loadSummary(forceReload = false): void {
    if (forceReload) {
      this.summaryResource.reload();
    }
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
