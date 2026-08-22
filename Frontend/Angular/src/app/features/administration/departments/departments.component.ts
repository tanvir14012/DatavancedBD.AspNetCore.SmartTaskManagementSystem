import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntil } from 'rxjs';
import { BaseCrudComponent } from '../../../shared/components/base-crud/base-crud.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  PageHeaderComponent,
  PageAction,
} from '../../../shared/components/page-header/page-header.component';
import { DepartmentsService, DepartmentDto } from './departments.service';
import { TableColumn, TableAction } from '../../../shared/components/data-table/data-table.model';
import { QueryParams } from '../../../shared/models/query-params.model';
import { toClientPagedResult } from '../../../shared/utils/client-paging.utils';
import { DepartmentFormDialogComponent } from './department-form-dialog.component';
import { PdfExportService } from '../../../shared/services/pdf-export.service';
import { TableExportTemplateDto } from '../../../shared/models/template-dto.model';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    DataTableComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header titleKey="administration.departments.title" [actions]="headerActions" />

    <app-data-table
      titleKey="administration.departments.title"
      [columns]="columns"
      [actions]="tableActions"
      [data]="pagedResult()"
      [isLoading]="isLoading()"
      (queryChange)="onQueryChange($event)"
    />
  `,
})
export class DepartmentsComponent extends BaseCrudComponent<DepartmentDto> {
  private readonly service = inject(DepartmentsService);
  private readonly pdfExport = inject(PdfExportService);

  readonly columns: TableColumn<DepartmentDto>[] = [
    { key: 'nameEn', headerKey: 'administration.departments.fields.nameEn', sortable: true },
    { key: 'nameAr', headerKey: 'administration.departments.fields.nameAr', sortable: true },
    {
      key: 'code',
      headerKey: 'administration.departments.fields.code',
      sortable: true,
      width: '120px',
    },
    {
      key: 'isActive',
      headerKey: 'common.status',
      pipe: 'boolean',
      width: '100px',
      pdfRender: (row) =>
        this.translate.instant(row.isActive ? 'common.active' : 'common.inactive'),
    },
    {
      key: 'createdAt',
      headerKey: 'common.createdAt',
      pipe: 'localDate',
      sortable: true,
      pdfRender: (row) => new Date(row.createdAt),
    },
  ];

  readonly tableActions: TableAction<DepartmentDto>[] = [
    {
      icon: 'edit',
      tooltipKey: 'common.edit',
      color: 'primary',
      permission: 'departments.update',
      action: (row) => this.openForm(row),
    },
    {
      icon: 'delete',
      tooltipKey: 'common.delete',
      color: 'warn',
      permission: 'departments.delete',
      action: (row) => this.onDelete(row, 'nameEn'),
    },
  ];

  readonly headerActions: PageAction[] = [
    {
      labelKey: 'administration.departments.addNew',
      icon: 'add',
      permission: 'departments.create',
      action: () => this.openForm(),
    },
    {
      labelKey: 'common.exportPdf',
      icon: 'picture_as_pdf',
      action: () => this.exportPdf(),
      color: 'accent',
    },
  ];

  protected loadData(): void {
    this.isLoading.set(true);
    this.service
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.pagedResult.set(
            toClientPagedResult(result, this.queryParams(), ['nameEn', 'nameAr', 'code']),
          );
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  openForm(item?: DepartmentDto): void {
    this.dialog
      .open(DepartmentFormDialogComponent, { data: item ?? null, width: '680px' })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) {
          this.loadData();
        }
      });
  }

  protected deleteItem(item: DepartmentDto) {
    return this.service.delete(item.id);
  }

  private exportPdf(): void {
    const items = this.pagedResult().items;
    const template: TableExportTemplateDto<DepartmentDto> = {
      fileName: 'departments',
      title: this.translate.instant('administration.departments.title'),
      subtitle: `${this.translate.instant('common.total')}: ${this.pagedResult().totalCount}`,
      rows: items,
      columns: this.columns,
      orientation: 'landscape',
      resolveHeader: (headerKey: string) => this.translate.instant(headerKey),
    };
    void this.pdfExport.exportTable(template).catch(() => this.notify.error('common.error'));
  }
}
