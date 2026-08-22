import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { TranslateLookupPipe } from '../../pipes/translate-lookup.pipe';
import { LocalDatePipe } from '../../pipes/local-date.pipe';
import { FileSizePipe } from '../../pipes/file-size.pipe';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PagedResult } from '../../models/paged-result.model';
import { QueryParams, SortDirection } from '../../models/query-params.model';
import { TableColumn, TableAction } from './data-table.model';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
    HasPermissionDirective,
    TranslateLookupPipe,
    LocalDatePipe,
    FileSizePipe,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Search bar -->
    @if (searchable()) {
      <mat-form-field class="w-full mb-4" appearance="outline">
        <mat-label>{{ 'common.search' | translate }}</mat-label>
        <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onSearch()" />
        <button matSuffix mat-icon-button (click)="onSearch()">
          <mat-icon>search</mat-icon>
        </button>
        @if (searchTerm) {
          <button matSuffix mat-icon-button (click)="clearSearch()">
            <mat-icon>clear</mat-icon>
          </button>
        }
      </mat-form-field>
    }

    <!-- Loading bar -->
    @if (isLoading()) {
      <mat-progress-bar mode="indeterminate" class="mb-1" />
    }

    <!-- Table -->
    <div
      class="table-container overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <table
        mat-table
        [dataSource]="data().items"
        matSort
        (matSortChange)="onSort($event)"
        class="w-full"
        [attr.aria-label]="titleKey() | translate"
      >
        <!-- Selection column -->
        @if (selectable()) {
          <ng-container matColumnDef="__select">
            <th mat-header-cell *matHeaderCellDef class="w-10">
              <mat-checkbox
                (change)="toggleAll($event.checked)"
                [checked]="allSelected()"
                [indeterminate]="someSelected()"
              />
            </th>
            <td mat-cell *matCellDef="let row" class="w-10">
              <mat-checkbox [checked]="isSelected(row)" (change)="toggleRow(row, $event.checked)" />
            </td>
          </ng-container>
        }

        <!-- Dynamic columns -->
        @for (col of columns(); track col.key) {
          <ng-container
            [matColumnDef]="col.key.toString()"
            [sticky]="col.sticky === 'start'"
            [stickyEnd]="col.sticky === 'end'"
          >
            <th
              mat-header-cell
              *matHeaderCellDef
              [mat-sort-header]="col.sortable ? col.key.toString() : ''"
              [disabled]="!col.sortable"
              [style.width]="col.width"
            >
              {{ col.headerKey | translate }}
            </th>
            <td mat-cell *matCellDef="let row">
              @if (col.render) {
                {{ col.render(row) }}
              } @else if (col.pipe === 'localDate') {
                {{ $any(getCellValue(row, col)) | localDate }}
              } @else if (col.pipe === 'fileSize') {
                {{ $any(getCellValue(row, col)) | fileSize }}
              } @else if (col.pipe === 'boolean') {
                <mat-icon [class]="getCellValue(row, col) ? 'text-green-500' : 'text-red-400'">
                  {{ getCellValue(row, col) ? 'check_circle' : 'cancel' }}
                </mat-icon>
              } @else {
                {{ getCellValue(row, col) }}
              }
            </td>
          </ng-container>
        }

        <!-- Actions column -->
        @if (actions().length) {
          <ng-container matColumnDef="__actions" stickyEnd>
            <th mat-header-cell *matHeaderCellDef class="w-24 text-center">
              {{ 'common.actions' | translate }}
            </th>
            <td mat-cell *matCellDef="let row" class="text-center">
              @for (action of actions(); track action.icon) {
                @if (!action.visible || action.visible(row)) {
                  @if (!action.permission) {
                    <button
                      mat-icon-button
                      [color]="action.color"
                      [matTooltip]="action.tooltipKey | translate"
                      (click)="action.action(row)"
                    >
                      <mat-icon>{{ action.icon }}</mat-icon>
                    </button>
                  } @else {
                    <button
                      mat-icon-button
                      [color]="action.color"
                      [matTooltip]="action.tooltipKey | translate"
                      (click)="action.action(row)"
                      *hasPermission="action.permission"
                    >
                      <mat-icon>{{ action.icon }}</mat-icon>
                    </button>
                  }
                }
              }
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: displayedColumns()"
          [class.selected-row]="isSelected(row)"
          (click)="onRowClick(row)"
        ></tr>

        <!-- No data row -->
        <tr class="mat-row" *matNoDataRow>
          <td [attr.colspan]="displayedColumns().length" class="p-0">
            @if (!isLoading()) {
              <app-empty-state />
            }
          </td>
        </tr>
      </table>
    </div>

    <!-- Paginator -->
    <mat-paginator
      [length]="data().totalCount"
      [pageSize]="data().pageSize"
      [pageIndex]="data().page - 1"
      [pageSizeOptions]="pageSizeOptions()"
      (page)="onPage($event)"
      showFirstLastButtons
    />
  `,
  styles: [
    `
      .selected-row {
        background: var(--mat-table-row-item-selected-background-color, rgba(0, 0, 0, 0.04));
      }
      .table-container mat-progress-bar {
        position: sticky;
        top: 0;
        z-index: 2;
      }
    `,
  ],
})
export class DataTableComponent<T extends { id: string }> implements OnChanges {
  readonly titleKey = input<string>('');
  readonly columns = input.required<TableColumn<T>[]>();
  readonly actions = input<TableAction<T>[]>([]);
  readonly data = input.required<PagedResult<T>>();
  readonly isLoading = input<boolean>(false);
  readonly searchable = input<boolean>(true);
  readonly selectable = input<boolean>(false);
  readonly pageSizeOptions = input<number[]>([10, 25, 50, 100]);

  readonly queryChange = output<Partial<QueryParams>>();
  readonly rowClick = output<T>();
  readonly selectionChange = output<T[]>();

  searchTerm = '';
  private _selected = signal<Set<string>>(new Set());

  readonly displayedColumns = computed(() => {
    const cols: string[] = [];
    if (this.selectable()) cols.push('__select');
    cols.push(...this.columns().map((c) => c.key.toString()));
    if (this.actions().length) cols.push('__actions');
    return cols;
  });

  readonly allSelected = computed(
    () =>
      this.data().items.length > 0 && this.data().items.every((r) => this._selected().has(r.id)),
  );
  readonly someSelected = computed(
    () => this.data().items.some((r) => this._selected().has(r.id)) && !this.allSelected(),
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this._selected.set(new Set());
    }
  }

  getCellValue(row: T, col: TableColumn<T>): unknown {
    return (row as Record<string, unknown>)[col.key as string];
  }

  onSort(sort: Sort): void {
    this.queryChange.emit({
      sortBy: sort.active,
      sortDirection: sort.direction as SortDirection,
      page: 1,
    });
  }

  onPage(event: PageEvent): void {
    this.queryChange.emit({ page: event.pageIndex + 1, pageSize: event.pageSize });
  }

  onSearch(): void {
    this.queryChange.emit({ search: this.searchTerm, page: 1 });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.queryChange.emit({ search: '', page: 1 });
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  isSelected(row: T): boolean {
    return this._selected().has(row.id);
  }

  toggleRow(row: T, checked: boolean): void {
    const set = new Set(this._selected());
    checked ? set.add(row.id) : set.delete(row.id);
    this._selected.set(set);
    this.selectionChange.emit(this.data().items.filter((r) => set.has(r.id)));
  }

  toggleAll(checked: boolean): void {
    const set = checked ? new Set(this.data().items.map((r) => r.id)) : new Set<string>();
    this._selected.set(set);
    this.selectionChange.emit(checked ? [...this.data().items] : []);
  }
}
