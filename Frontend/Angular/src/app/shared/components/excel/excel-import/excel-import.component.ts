import { Component, ChangeDetectionStrategy, inject, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
import { ExcelService, ExcelColumn } from '../../../services/excel.service';

export interface ImportConfig<T> {
  /** Map of spreadsheet column header -> model field key */
  columnMap: Record<string, keyof T | string>;
  /** List of expected column headers for UI mapping dialog */
  expectedColumns?: string[];
}

@Component({
  selector: 'app-excel-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    MatTableModule,
    MatProgressBarModule,
    MatChipsModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="excel-import">
      <!-- Drop zone -->
      @if (!selectedFile()) {
        <div
          class="drop-zone border-2 border-dashed border-gray-300 dark:border-gray-600
                    rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          (click)="fileInput.click()"
          (dragover)="$event.preventDefault()"
          (drop)="onDrop($event)"
        >
          <mat-icon class="!text-4xl text-gray-400 mb-2">cloud_upload</mat-icon>
          <p class="text-gray-500">{{ 'common.dragDropHint' | translate }}</p>
          <p class="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv</p>
        </div>
        <input
          #fileInput
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          (change)="onFileSelect($event)"
        />
      } @else {
        <!-- Preview / mapping -->
        <div
          class="file-info flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4"
        >
          <mat-icon class="text-green-500">insert_drive_file</mat-icon>
          <div class="flex-1">
            <p class="font-medium text-sm">{{ selectedFile()!.name }}</p>
            <p class="text-xs text-gray-500">
              {{ previewRows().length }}
              {{ 'common.rowsToImport' | translate: { count: previewRows().length } }}
            </p>
          </div>
          <button mat-icon-button color="warn" (click)="reset()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Progress -->
        @if (isProcessing()) {
          <mat-progress-bar mode="indeterminate" class="mb-3" />
          <p class="text-sm text-center text-gray-500">{{ 'common.processing' | translate }}</p>
        }

        <!-- Import errors -->
        @if (importErrors().length) {
          <div class="errors mt-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-warn font-medium text-sm">
                {{ 'common.importErrors' | translate: { count: importErrors().length } }}
              </span>
              <button mat-stroked-button color="warn" (click)="downloadErrorReport()">
                <mat-icon>download</mat-icon>
                {{ 'common.downloadErrorReport' | translate }}
              </button>
            </div>
          </div>
        }

        <!-- Actions -->
        @if (!isProcessing()) {
          <div class="mt-4 flex justify-end gap-2">
            <button mat-stroked-button (click)="reset()">{{ 'common.cancel' | translate }}</button>
            <button mat-flat-button color="primary" (click)="doImport()">
              <mat-icon>upload</mat-icon>
              {{ 'common.import' | translate }}
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class ExcelImportComponent<T extends object> {
  private readonly excelSvc = inject(ExcelService);

  readonly columnMap = input.required<Record<string, keyof T | string>>();
  readonly importSuccess = output<T[]>();
  readonly importError = output<Array<{ row: number; field: string; message: string }>>();

  readonly selectedFile = signal<File | null>(null);
  readonly previewRows = signal<T[]>([]);
  readonly isProcessing = signal(false);
  readonly importErrors = signal<Array<{ row: number; field: string; message: string }>>([]);

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this._loadFile(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this._loadFile(file);
  }

  private async _loadFile(file: File): Promise<void> {
    this.selectedFile.set(file);
    this.isProcessing.set(true);
    try {
      const rows = await this.excelSvc.parseFile<T>(file, this.columnMap());
      this.previewRows.set(rows);
    } finally {
      this.isProcessing.set(false);
    }
  }

  doImport(): void {
    this.importSuccess.emit(this.previewRows());
  }

  downloadErrorReport(): void {
    this.excelSvc.exportErrorReport(this.importErrors());
  }

  reset(): void {
    this.selectedFile.set(null);
    this.previewRows.set([]);
    this.importErrors.set([]);
    this.isProcessing.set(false);
  }
}
