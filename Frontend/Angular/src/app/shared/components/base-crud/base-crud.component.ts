import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { PagedResult, emptyPagedResult } from '../../models/paged-result.model';
import { QueryParams } from '../../models/query-params.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../services/permission.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../confirm-dialog/confirm-dialog.component';
import { Observable } from 'rxjs';

/**
 * Abstract base for all list/CRUD views.
 *
 * Subclasses only need to:
 *  1. Inject and assign `this.dataSource$`
 *  2. Implement `loadData()` to fetch and populate `this.pagedResult`
 *  3. Implement `openForm()` for create/edit dialogs
 *  4. Implement `deleteItem()` to call the API
 */
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
export abstract class BaseCrudComponent<T extends { id: string }> implements OnInit, OnDestroy {
  protected readonly dialog = inject(MatDialog);
  protected readonly notify = inject(NotificationService);
  protected readonly permissions = inject(PermissionService);
  protected readonly translate = inject(TranslateService);
  protected readonly destroy$ = new Subject<void>();

  // --- Signals ---
  readonly isLoading = signal(false);
  readonly pagedResult = signal<PagedResult<T>>(emptyPagedResult<T>());
  readonly items = computed(() => this.pagedResult().items);
  readonly totalCount = computed(() => this.pagedResult().totalCount);

  // --- Query state ---
  protected queryParams = signal<QueryParams>({
    page: 1,
    pageSize: 10,
    sortBy: '',
    sortDirection: '',
    search: '',
    filters: [],
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Override to fetch paged data and call this.pagedResult.set(result). */
  protected abstract loadData(): void;

  /** Override to open a create or edit dialog. */
  abstract openForm(item?: T): void;

  /** Override to call the API delete endpoint. */
  protected abstract deleteItem(item: T): Observable<void>;

  /** Handles sort/page/search events from DataTableComponent. */
  onQueryChange(params: Partial<QueryParams>): void {
    this.queryParams.update((current) => ({ ...current, ...params }));
    this.loadData();
  }

  /** Confirms and deletes an item. */
  onDelete(item: T, nameKey?: string): void {
    const name = nameKey ? ((item as Record<string, unknown>)[nameKey] as string) : '';
    const data: ConfirmDialogData = {
      titleKey: 'common.delete',
      messageKey: 'common.deleteConfirm',
      messageParams: { name },
      confirmKey: 'common.delete',
      confirmColor: 'warn',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data, width: '400px' })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.isLoading.set(true);
          this.deleteItem(item)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.notify.success('common.success');
                this.loadData();
              },
              error: () => this.isLoading.set(false),
              complete: () => this.isLoading.set(false),
            });
        }
      });
  }

  /** Apply server validation errors to a form group. */
  protected applyServerErrors(
    form: FormGroup,
    errors: Array<{ propertyName: string; errorMessage: string }>,
  ): void {
    errors.forEach(({ propertyName, errorMessage }) => {
      const key = propertyName.charAt(0).toLowerCase() + propertyName.slice(1);
      const ctrl = form.get(key);
      if (ctrl) {
        ctrl.setErrors({ serverError: errorMessage });
        ctrl.markAsTouched();
      }
    });
  }
}
