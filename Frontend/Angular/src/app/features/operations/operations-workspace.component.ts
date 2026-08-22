import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { TableColumn } from '../../shared/components/data-table/data-table.model';
import { emptyPagedResult, PagedResult } from '../../shared/models/paged-result.model';
import { QueryParams } from '../../shared/models/query-params.model';
import { toClientPagedResult } from '../../shared/utils/client-paging.utils';
import { OperationsService } from './operations.service';
import {
  ModuleNavigationDto,
  ModuleNavigationService,
} from '../administration/module-navigation/module-navigation.service';

type OperationRow = { id: string };

interface MetricCard {
  label: string;
  value: string;
  icon: string;
  tone: string;
}

interface ModuleConfig {
  columns: TableColumn<OperationRow>[];
  searchableKeys: string[];
  load: () => Observable<OperationRow[]>;
  metrics: (rows: OperationRow[]) => MetricCard[];
  filterByView?: (viewSlug: string | null, row: OperationRow) => boolean;
}

@Component({
  selector: 'app-operations-workspace',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    DataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-semibold m-0">{{ pageTitle() }}</h1>
        @if (pageSubtitle()) {
          <p class="text-sm text-gray-500 mt-1 mb-0">{{ pageSubtitle() }}</p>
        }
      </div>
    </div>

    @if (isLoading()) {
      <mat-progress-bar mode="indeterminate" class="mb-4" />
    }

    @if (unsupportedReason()) {
      <mat-card>
        <mat-card-content class="p-4">
          <div class="flex items-start gap-3">
            <mat-icon class="text-amber-600">pending_actions</mat-icon>
            <div>
              <div class="font-semibold mb-1">TODO</div>
              <p class="m-0 text-sm text-gray-600">{{ unsupportedReason() }}</p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        @for (metric of metrics(); track metric.label) {
          <mat-card class="metric-card">
            <mat-card-content class="p-4 flex items-center gap-3">
              <div class="metric-icon" [style.background]="metric.tone">
                <mat-icon>{{ metric.icon }}</mat-icon>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-gray-500">{{ metric.label }}</div>
                <div class="text-xl font-semibold">{{ metric.value }}</div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <app-data-table
        titleKey="navigation.operations"
        [columns]="columns()"
        [data]="pagedRows()"
        [isLoading]="isLoading()"
        [searchable]="true"
        (queryChange)="onQueryChange($event)"
      />
    }
  `,
  styles: [
    `
      .metric-card {
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
      .metric-icon {
        width: 42px;
        height: 42px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: white;
      }
    `,
  ],
})
export class OperationsWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationsService = inject(OperationsService);
  private readonly navigationService = inject(ModuleNavigationService);

  readonly isLoading = signal(false);
  readonly pageTitle = signal('Operations');
  readonly pageSubtitle = signal<string | null>(null);
  readonly unsupportedReason = signal<string | null>(null);
  readonly metrics = signal<MetricCard[]>([]);
  readonly columns = signal<TableColumn<OperationRow>[]>([]);
  readonly pagedRows = signal<PagedResult<OperationRow>>(emptyPagedResult<OperationRow>());

  private readonly allRows = signal<OperationRow[]>([]);
  private readonly searchKeys = signal<string[]>([]);
  private readonly query = signal<QueryParams>({
    page: 1,
    pageSize: 10,
    sortBy: '',
    sortDirection: '',
    search: '',
    filters: [],
  });
  private readonly moduleSlug = signal('');
  private readonly viewSlug = signal<string | null>(null);

  private readonly moduleConfigs: Record<string, ModuleConfig> = {
    procurement: {
      columns: [
        { key: 'orderNumber', headerKey: 'operations.headers.orderNumber', sortable: true },
        { key: 'supplierName', headerKey: 'operations.headers.supplier', sortable: true },
        { key: 'status', headerKey: 'common.status', sortable: true },
        {
          key: 'totalAmount',
          headerKey: 'operations.headers.amount',
          sortable: true,
          render: (row) => this.formatCurrency(Number(this.value(row, 'totalAmount') ?? 0)),
        },
        {
          key: 'expectedDeliveryDate',
          headerKey: 'operations.headers.expectedDate',
          pipe: 'localDate',
          sortable: true,
        },
      ],
      searchableKeys: ['orderNumber', 'supplierName', 'status'],
      load: () =>
        this.operationsService.getPurchaseOrders() as unknown as Observable<OperationRow[]>,
      metrics: (rows) => [
        this.metric('Orders', `${rows.length}`, 'shopping_cart', '#1d4ed8'),
        this.metric(
          'Approved',
          `${rows.filter((x) => this.value(x, 'status') === 'Approved').length}`,
          'task_alt',
          '#15803d',
        ),
        this.metric(
          'Delivered',
          `${rows.filter((x) => this.value(x, 'status') === 'Delivered').length}`,
          'local_shipping',
          '#7c3aed',
        ),
        this.metric(
          'Value',
          this.formatCurrency(
            rows.reduce((sum, row) => sum + Number(this.value(row, 'totalAmount') ?? 0), 0),
          ),
          'payments',
          '#b45309',
        ),
      ],
      filterByView: (view, row) => {
        const status = String(this.value(row, 'status') ?? '');
        switch (view) {
          case 'contract-awards':
            return status === 'Approved' || status === 'Delivered';
          case 'logistics-tracking':
            return status === 'Delivered';
          case 'vendor-vetting':
            return status === 'Draft' || status === 'Submitted';
          default:
            return true;
        }
      },
    },
    'store-management': {
      columns: [
        { key: 'nameEn', headerKey: 'operations.headers.item', sortable: true },
        { key: 'code', headerKey: 'administration.departments.fields.code', sortable: true },
        { key: 'unit', headerKey: 'operations.headers.unit', sortable: true },
        { key: 'currentQuantity', headerKey: 'operations.headers.onHand', sortable: true },
        { key: 'reorderLevel', headerKey: 'operations.headers.reorderLevel', sortable: true },
        {
          key: 'isBelowReorderLevel',
          headerKey: 'operations.headers.reorderAlert',
          pipe: 'boolean',
          sortable: true,
        },
      ],
      searchableKeys: ['nameEn', 'code', 'unit'],
      load: () =>
        this.operationsService.getInventoryItems() as unknown as Observable<OperationRow[]>,
      metrics: (rows) => [
        this.metric('Stock lines', `${rows.length}`, 'inventory_2', '#1d4ed8'),
        this.metric(
          'Low stock',
          `${rows.filter((x) => !!this.value(x, 'isBelowReorderLevel')).length}`,
          'warning',
          '#dc2626',
        ),
        this.metric(
          'Units on hand',
          `${rows.reduce((sum, row) => sum + Number(this.value(row, 'currentQuantity') ?? 0), 0)}`,
          'warehouse',
          '#15803d',
        ),
        this.metric(
          'Reorder points',
          `${rows.reduce((sum, row) => sum + Number(this.value(row, 'reorderLevel') ?? 0), 0)}`,
          'flag',
          '#7c3aed',
        ),
      ],
      filterByView: (view, row) =>
        view === 'reorder-alerts' ? !!this.value(row, 'isBelowReorderLevel') : true,
    },
    'issue-receipt': {
      columns: [
        {
          key: 'transactionNumber',
          headerKey: 'operations.headers.transactionNumber',
          sortable: true,
        },
        { key: 'transactionType', headerKey: 'operations.headers.transactionType', sortable: true },
        { key: 'counterparty', headerKey: 'operations.headers.counterparty', sortable: true },
        { key: 'quantity', headerKey: 'operations.headers.quantity', sortable: true },
        { key: 'date', headerKey: 'operations.headers.date', pipe: 'localDate', sortable: true },
      ],
      searchableKeys: ['transactionNumber', 'transactionType', 'counterparty', 'remarks'],
      load: () => this.operationsService.getTransactions() as unknown as Observable<OperationRow[]>,
      metrics: (rows) => [
        this.metric('Transactions', `${rows.length}`, 'swap_horiz', '#1d4ed8'),
        this.metric(
          'Issues',
          `${rows.filter((x) => this.value(x, 'transactionType') === 'Issue').length}`,
          'outbox',
          '#dc2626',
        ),
        this.metric(
          'Receipts',
          `${rows.filter((x) => this.value(x, 'transactionType') === 'Receipt').length}`,
          'inbox',
          '#15803d',
        ),
        this.metric(
          'Quantity moved',
          `${rows.reduce((sum, row) => sum + Number(this.value(row, 'quantity') ?? 0), 0)}`,
          'balance',
          '#7c3aed',
        ),
      ],
      filterByView: (view, row) => {
        if (view === 'issue-request') return this.value(row, 'transactionType') === 'Issue';
        if (view === 'receipt-confirmation')
          return this.value(row, 'transactionType') === 'Receipt';
        return true;
      },
    },
    'repair-maintenance': {
      columns: [
        { key: 'orderNumber', headerKey: 'operations.headers.orderNumber', sortable: true },
        { key: 'description', headerKey: 'operations.headers.description', sortable: true },
        { key: 'status', headerKey: 'common.status', sortable: true },
        {
          key: 'reportedDate',
          headerKey: 'operations.headers.reportedDate',
          pipe: 'localDate',
          sortable: true,
        },
        {
          key: 'completedDate',
          headerKey: 'operations.headers.completedDate',
          pipe: 'localDate',
          sortable: true,
        },
      ],
      searchableKeys: ['orderNumber', 'description', 'status'],
      load: () => this.operationsService.getRepairOrders() as unknown as Observable<OperationRow[]>,
      metrics: (rows) => [
        this.metric('Work orders', `${rows.length}`, 'build', '#1d4ed8'),
        this.metric(
          'Open',
          `${rows.filter((x) => this.value(x, 'status') !== 'Completed').length}`,
          'pending_actions',
          '#dc2626',
        ),
        this.metric(
          'In progress',
          `${rows.filter((x) => this.value(x, 'status') === 'InProgress').length}`,
          'engineering',
          '#15803d',
        ),
        this.metric(
          'Completed',
          `${rows.filter((x) => this.value(x, 'status') === 'Completed').length}`,
          'task_alt',
          '#7c3aed',
        ),
      ],
      filterByView: (view, row) => {
        if (view === 'maintenance-schedule') return this.value(row, 'status') !== 'Completed';
        if (view === 'parts-usage') return this.value(row, 'status') === 'Completed';
        return true;
      },
    },
    'traffic-security': {
      columns: [
        {
          key: 'vehicleRegistrationNumber',
          headerKey: 'operations.headers.vehicle',
          sortable: true,
        },
        { key: 'status', headerKey: 'common.status', sortable: true },
        {
          key: 'inspectionDate',
          headerKey: 'operations.headers.inspectionDate',
          pipe: 'localDate',
          sortable: true,
        },
        {
          key: 'nextInspectionDate',
          headerKey: 'operations.headers.nextInspectionDate',
          pipe: 'localDate',
          sortable: true,
        },
        { key: 'remarks', headerKey: 'operations.headers.remarks', sortable: true },
      ],
      searchableKeys: ['vehicleRegistrationNumber', 'status', 'remarks'],
      load: () =>
        this.operationsService.getVehicleSafetyRecords() as unknown as Observable<OperationRow[]>,
      metrics: (rows) => [
        this.metric('Inspections', `${rows.length}`, 'security', '#1d4ed8'),
        this.metric(
          'Passed',
          `${rows.filter((x) => this.value(x, 'status') === 'Passed').length}`,
          'verified_user',
          '#15803d',
        ),
        this.metric(
          'Alerts',
          `${rows.filter((x) => this.value(x, 'status') === 'RequiresAttention').length}`,
          'warning',
          '#d97706',
        ),
        this.metric(
          'Failed',
          `${rows.filter((x) => this.value(x, 'status') === 'Failed').length}`,
          'gpp_bad',
          '#dc2626',
        ),
      ],
      filterByView: (view, row) => {
        if (view === 'gate-control') return this.value(row, 'status') === 'Passed';
        if (view === 'incident-reports') return this.value(row, 'status') === 'Failed';
        if (view === 'threat-advisory')
          return (
            this.value(row, 'status') === 'RequiresAttention' ||
            this.value(row, 'status') === 'Failed'
          );
        return true;
      },
    },
  };

  constructor() {
    combineLatest([this.route.paramMap, this.navigationService.loadMilitaryModules(1)])
      .pipe(
        switchMap(([params, modules]) => this.loadModule(params, modules)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ rows, config }) => {
        this.isLoading.set(false);
        this.columns.set(config?.columns ?? []);
        this.searchKeys.set(config?.searchableKeys ?? []);
        this.allRows.set(rows);
        this.metrics.set(config?.metrics(rows) ?? []);
        this.rebuildPage();
      });
  }

  onQueryChange(params: Partial<QueryParams>): void {
    this.query.update((current) => ({ ...current, ...params }));
    this.rebuildPage();
  }

  private loadModule(paramMap: ParamMap, modules: ModuleNavigationDto[]) {
    const moduleSlug = paramMap.get('module') ?? '';
    const viewSlug = paramMap.get('view');
    this.moduleSlug.set(moduleSlug);
    this.viewSlug.set(viewSlug);
    this.query.update((current) => ({ ...current, page: 1 }));
    this.resolveTitles(modules, moduleSlug, viewSlug);

    const config = this.moduleConfigs[moduleSlug];
    if (!config) {
      this.unsupportedReason.set(
        'This module navigation is available, but its end-to-end workspace is deferred for a later pass to conserve AI credits.',
      );
      return of({ rows: [] as OperationRow[], config: null as ModuleConfig | null });
    }

    this.unsupportedReason.set(null);
    this.isLoading.set(true);

    return config.load().pipe(
      map((rows) => {
        const filteredRows = rows
          .filter((row) =>
            config.filterByView ? config.filterByView(viewSlug, row as OperationRow) : true,
          )
          .map((row) => row as OperationRow);
        return { rows: filteredRows, config };
      }),
    );
  }

  private resolveTitles(
    modules: ModuleNavigationDto[],
    moduleSlug: string,
    viewSlug: string | null,
  ): void {
    const module = modules.find(
      (item) => item.menuId === moduleSlug || item.systemName === moduleSlug,
    );
    const child = module && viewSlug ? this.findSidebarItem(module.sidebarItems, viewSlug) : null;
    this.pageTitle.set(module?.localizedName ?? this.titleize(moduleSlug));
    this.pageSubtitle.set(child?.localizedName ?? null);
  }

  private findSidebarItem(
    items: ModuleNavigationDto['sidebarItems'],
    viewSlug: string,
  ): ModuleNavigationDto['sidebarItems'][number] | null {
    for (const item of items) {
      if (item.menuId === viewSlug || item.systemName === viewSlug) {
        return item;
      }

      const child = this.findSidebarItem(item.children, viewSlug);
      if (child) {
        return child;
      }
    }

    return null;
  }

  private rebuildPage(): void {
    this.pagedRows.set(
      toClientPagedResult(
        this.allRows(),
        this.query(),
        this.searchKeys() as Array<keyof OperationRow>,
      ),
    );
  }

  private metric(label: string, value: string, icon: string, tone: string): MetricCard {
    return { label, value, icon, tone };
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private titleize(value: string): string {
    return value
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private value(row: OperationRow, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }
}
