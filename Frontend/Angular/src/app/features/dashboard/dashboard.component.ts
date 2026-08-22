import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OperationsService } from '../operations/operations.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <mat-progress-bar mode="indeterminate" class="mb-4" />
    }

    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">ORDISS command workspace</p>
        <h1>Dashboard</h1>
        <p class="hero-copy">
          Operational inventory, movement, procurement, and readiness signals in one responsive
          admin landing page.
        </p>
      </div>
      <div class="readiness-pill">
        <mat-icon>verified_user</mat-icon>
        <span>System ready</span>
      </div>
    </section>

    <div class="stat-grid">
      @for (card of statCards(); track card.titleKey) {
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon" [style.background]="card.color">
              <mat-icon>{{ card.icon }}</mat-icon>
            </div>
            <div class="stat-copy">
              <p>{{ card.titleKey }}</p>
              <strong>{{ card.value }}</strong>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <div class="chart-grid">
      <mat-card class="chart-card wide-card">
        <mat-card-header>
          <mat-card-title>Operational activity</mat-card-title>
          <mat-card-subtitle>Procurement, issue/receipt, and security trend</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="bar-chart" aria-label="Operational activity chart">
            @for (bar of barSeries; track bar.label) {
              <div class="bar-group">
                <div class="bar-stack">
                  <span class="bar procurement" [style.height.%]="bar.procurement"></span>
                  <span class="bar issue" [style.height.%]="bar.issueReceipt"></span>
                  <span class="bar security" [style.height.%]="bar.security"></span>
                </div>
                <span class="axis-label">{{ bar.label }}</span>
              </div>
            }
          </div>
          <div class="legend">
            <span><i class="procurement-dot"></i>Procurement</span>
            <span><i class="issue-dot"></i>Issue & Receipt</span>
            <span><i class="security-dot"></i>Traffic & Security</span>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="chart-card">
        <mat-card-header>
          <mat-card-title>Inventory mix</mat-card-title>
          <mat-card-subtitle>Current operational split</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="pie-chart" aria-label="Inventory mix chart"></div>
          <div class="pie-legend">
            @for (segment of activityMix; track segment.label) {
              <span
                ><i [style.background]="segment.color"></i>{{ segment.label }}
                {{ segment.value }}%</span
              >
            }
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="chart-card wide-card">
        <mat-card-header>
          <mat-card-title>Readiness curve</mat-card-title>
          <mat-card-subtitle>Seven-month readiness signal</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <svg class="line-chart" viewBox="0 0 640 220" role="img" aria-label="Readiness curve">
            <polyline points="0,154 80,154 160,124 240,80 320,86 400,52 480,76 560,44 640,28" />
            @for (point of readinessPoints; track point.x) {
              <circle [attr.cx]="point.x" [attr.cy]="point.y" r="5" />
            }
          </svg>
        </mat-card-content>
      </mat-card>
    </div>

    <div class="focus-grid">
      <mat-card class="focus-card">
        <mat-card-header><mat-card-title>Procurement posture</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (order of procurementFocus(); track order.id) {
            <div class="focus-row">
              <div>
                <div class="focus-title">{{ order.orderNumber }}</div>
                <div class="focus-subtitle">{{ order.supplierName }}</div>
              </div>
              <div class="status-chip">{{ order.status }}</div>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="focus-card">
        <mat-card-header><mat-card-title>Supply pressure points</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (item of lowStockItems(); track item.id) {
            <div class="focus-row">
              <div>
                <div class="focus-title">{{ item.nameEn }}</div>
                <div class="focus-subtitle">{{ item.code }}</div>
              </div>
              <div class="status-chip warn">
                {{ item.currentQuantity }} / {{ item.reorderLevel }}
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="focus-card">
        <mat-card-header
          ><mat-card-title>Security & maintenance alerts</mat-card-title></mat-card-header
        >
        <mat-card-content>
          @for (alert of alerts(); track alert.id) {
            <div class="focus-row">
              <div>
                <div class="focus-title">{{ alert.title }}</div>
                <div class="focus-subtitle">{{ alert.subtitle }}</div>
              </div>
              <div
                class="status-chip"
                [class.danger]="alert.severity === 'High'"
                [class.warn]="alert.severity === 'Medium'"
              >
                {{ alert.severity }}
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .dashboard-hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 18px;
        padding: 22px;
        border: 1px solid rgba(0, 97, 75, 0.12);
        border-radius: 16px;
        background:
          radial-gradient(circle at top right, rgba(0, 97, 75, 0.14), transparent 34%),
          linear-gradient(135deg, #ffffff 0%, #edf6f3 100%);
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
      }
      .eyebrow {
        margin: 0 0 6px;
        color: #00614b;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        color: #10231e;
        font-size: clamp(28px, 4vw, 42px);
        font-weight: 800;
      }
      .hero-copy {
        max-width: 680px;
        margin: 8px 0 0;
        color: #64748b;
      }
      .readiness-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        color: #00614b;
        background: #dff0eb;
        font-weight: 700;
        white-space: nowrap;
      }
      .stat-grid,
      .focus-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }
      .stat-card,
      .chart-card,
      .focus-card {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 14px;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
      }
      .stat-card mat-card-content {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
      }
      .stat-icon {
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #fff;
        flex: 0 0 auto;
      }
      .stat-copy p {
        margin: 0;
        color: #64748b;
        font-size: 12px;
      }
      .stat-copy strong {
        display: block;
        margin-top: 3px;
        color: #0f172a;
        font-size: 26px;
        line-height: 1;
      }
      .chart-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }
      .wide-card {
        grid-column: span 2;
      }
      .bar-chart {
        height: 230px;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 4px 0;
        border-bottom: 1px solid #dbe5e1;
      }
      .bar-group {
        flex: 1;
        min-width: 28px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        height: 100%;
      }
      .bar-stack {
        height: 190px;
        width: 100%;
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 5px;
      }
      .bar {
        width: min(16px, 26%);
        min-height: 8px;
        border-radius: 999px 999px 3px 3px;
      }
      .procurement {
        background: #0f766e;
      }
      .issue {
        background: #2f80ed;
      }
      .security {
        background: #d99b18;
      }
      .axis-label {
        color: #64748b;
        font-size: 11px;
      }
      .legend,
      .pie-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 16px;
        margin-top: 14px;
        color: #64748b;
        font-size: 12px;
      }
      .legend span,
      .pie-legend span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend i,
      .pie-legend i {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display: inline-block;
      }
      .procurement-dot {
        background: #0f766e;
      }
      .issue-dot {
        background: #2f80ed;
      }
      .security-dot {
        background: #d99b18;
      }
      .pie-chart {
        width: min(210px, 100%);
        aspect-ratio: 1;
        margin: 14px auto 8px;
        border-radius: 50%;
        background: conic-gradient(
          #0f766e 0 52%,
          #90aaa5 52% 72%,
          #d99b18 72% 90%,
          #ca8a8a 90% 100%
        );
        box-shadow: inset 0 0 0 18px rgba(255, 255, 255, 0.6);
      }
      .line-chart {
        width: 100%;
        min-height: 220px;
      }
      .line-chart polyline {
        fill: none;
        stroke: #0f766e;
        stroke-width: 5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .line-chart circle {
        fill: #fff;
        stroke: #0f766e;
        stroke-width: 4;
      }
      .focus-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .focus-card mat-card-content {
        padding-top: 8px;
      }
      .focus-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 11px 0;
        border-bottom: 1px solid #eef2f1;
      }
      .focus-row:last-child {
        border-bottom: 0;
      }
      .focus-title {
        color: #1e293b;
        font-weight: 700;
      }
      .focus-subtitle {
        margin-top: 3px;
        color: #64748b;
        font-size: 12px;
      }
      .status-chip {
        padding: 5px 8px;
        border-radius: 999px;
        color: #00614b;
        background: #e2f0ec;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .status-chip.warn {
        color: #92400e;
        background: #fef3c7;
      }
      .status-chip.danger {
        color: #991b1b;
        background: #fee2e2;
      }
      @media (max-width: 1180px) {
        .stat-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .chart-grid,
        .focus-grid {
          grid-template-columns: 1fr;
        }
        .wide-card {
          grid-column: auto;
        }
      }
      @media (max-width: 640px) {
        .dashboard-hero {
          align-items: flex-start;
          flex-direction: column;
          padding: 16px;
        }
        .stat-grid {
          grid-template-columns: 1fr;
        }
        .bar-chart {
          gap: 6px;
          overflow-x: auto;
        }
        .bar-group {
          min-width: 40px;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly operationsService = inject(OperationsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly procurementFocus = signal<
    Array<{ id: string; orderNumber: string; supplierName: string; status: string }>
  >([]);
  readonly lowStockItems = signal<
    Array<{
      id: string;
      nameEn: string;
      code: string;
      currentQuantity: number;
      reorderLevel: number;
    }>
  >([]);
  readonly alerts = signal<
    Array<{ id: string; title: string; subtitle: string; severity: 'High' | 'Medium' }>
  >([]);
  readonly statCards = signal([
    { titleKey: 'Approved purchase orders', icon: 'shopping_cart', value: '0', color: '#3f51b5' },
    { titleKey: 'Low stock alerts', icon: 'warehouse', value: '0', color: '#e65100' },
    { titleKey: 'Movement transactions', icon: 'swap_horiz', value: '0', color: '#7b1fa2' },
    { titleKey: 'Open repairs', icon: 'build', value: '0', color: '#00897b' },
  ]);
  readonly barSeries = [
    { label: 'Feb', procurement: 38, issueReceipt: 64, security: 32 },
    { label: 'Mar', procurement: 58, issueReceipt: 74, security: 44 },
    { label: 'Apr', procurement: 54, issueReceipt: 68, security: 36 },
    { label: 'May', procurement: 66, issueReceipt: 82, security: 42 },
    { label: 'Jun', procurement: 62, issueReceipt: 76, security: 48 },
    { label: 'Jul', procurement: 72, issueReceipt: 88, security: 52 },
    { label: 'Aug', procurement: 70, issueReceipt: 92, security: 54 },
  ];
  readonly activityMix = [
    { label: 'Serviceable', value: 52, color: '#0f766e' },
    { label: 'Reserve', value: 20, color: '#90aaa5' },
    { label: 'Transit', value: 18, color: '#d99b18' },
    { label: 'Alert', value: 10, color: '#ca8a8a' },
  ];
  readonly readinessPoints = [
    { x: 0, y: 154 },
    { x: 80, y: 154 },
    { x: 160, y: 124 },
    { x: 240, y: 80 },
    { x: 320, y: 86 },
    { x: 400, y: 52 },
    { x: 480, y: 76 },
    { x: 560, y: 44 },
    { x: 640, y: 28 },
  ];

  constructor() {
    forkJoin({
      purchaseOrders: this.operationsService.getPurchaseOrders(),
      inventoryItems: this.operationsService.getInventoryItems(),
      transactions: this.operationsService.getTransactions(),
      repairOrders: this.operationsService.getRepairOrders(),
      safetyRecords: this.operationsService.getVehicleSafetyRecords(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        const approvedOrders = result.purchaseOrders.filter(
          (order) => order.status === 'Approved' || order.status === 'Delivered',
        );
        const lowStock = result.inventoryItems.filter((item) => item.isBelowReorderLevel);
        const openRepairs = result.repairOrders.filter((order) => order.status !== 'Completed');

        this.statCards.set([
          {
            titleKey: 'Approved purchase orders',
            icon: 'shopping_cart',
            value: `${approvedOrders.length}`,
            color: '#3f51b5',
          },
          {
            titleKey: 'Low stock alerts',
            icon: 'warehouse',
            value: `${lowStock.length}`,
            color: '#e65100',
          },
          {
            titleKey: 'Movement transactions',
            icon: 'swap_horiz',
            value: `${result.transactions.length}`,
            color: '#7b1fa2',
          },
          {
            titleKey: 'Open repairs',
            icon: 'build',
            value: `${openRepairs.length}`,
            color: '#00897b',
          },
        ]);

        this.procurementFocus.set(result.purchaseOrders.slice(0, 3));
        this.lowStockItems.set(lowStock.slice(0, 3));
        this.alerts.set(
          [
            ...result.safetyRecords
              .filter((record) => record.status !== 'Passed')
              .map((record) => ({
                id: record.id,
                title: record.vehicleRegistrationNumber,
                subtitle: record.remarks || 'Safety review required',
                severity: record.status === 'Failed' ? ('High' as const) : ('Medium' as const),
              })),
            ...openRepairs.slice(0, 2).map((order) => ({
              id: order.id,
              title: order.orderNumber,
              subtitle: order.description,
              severity: 'Medium' as const,
            })),
          ].slice(0, 5),
        );

        this.isLoading.set(false);
      });
  }
}
