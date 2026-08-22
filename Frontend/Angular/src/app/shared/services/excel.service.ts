import { Injectable, inject } from '@angular/core';
import { utils, writeFile, read, WorkBook, WorkSheet } from 'xlsx';
import { saveAs } from 'file-saver';
import { ValidationError } from '../models/validation-error.model';

export interface ExcelColumn<T = Record<string, unknown>> {
  header: string;
  key: keyof T | string;
  width?: number;
  formatter?: (value: unknown, row: T) => string | number;
}

export interface ImportResult<T> {
  rows: T[];
  errors: Array<{ row: number; field: string; message: string }>;
}

@Injectable({ providedIn: 'root' })
export class ExcelService {
  /**
   * Export data to an xlsx file.
   */
  export<T extends object>(
    data: T[],
    columns: ExcelColumn<T>[],
    fileName: string,
    sheetName = 'Sheet1',
  ): void {
    const headers = columns.map((c) => c.header);
    const rows = data.map((row) =>
      columns.map((col) => {
        const value = (row as Record<string, unknown>)[col.key as string];
        return col.formatter ? col.formatter(value, row) : (value ?? '');
      }),
    );

    const ws: WorkSheet = utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 20 }));

    const wb: WorkBook = utils.book_new();
    utils.book_append_sheet(wb, ws, sheetName);
    writeFile(wb, `${fileName}.xlsx`);
  }

  /**
   * Export rows with backend-provided validation errors as a report.
   */
  exportErrorReport(
    errors: Array<{ row: number; field: string; message: string }>,
    fileName = 'import-errors',
  ): void {
    this.export(
      errors,
      [
        { header: 'Row', key: 'row', width: 8 },
        { header: 'Field', key: 'field', width: 20 },
        { header: 'Error', key: 'message', width: 50 },
      ],
      fileName,
    );
  }

  /**
   * Parse an xlsx/csv file into rows of key-value objects.
   * @param file The uploaded File
   * @param columnMap Maps spreadsheet header -> model key
   */
  parseFile<T extends object>(
    file: File,
    columnMap: Record<string, keyof T | string>,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: '' });

          const result = raw.map((row) => {
            const mapped: Record<string, unknown> = {};
            for (const [srcKey, dstKey] of Object.entries(columnMap)) {
              mapped[dstKey as string] = row[srcKey] ?? '';
            }
            return mapped as T;
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read spreadsheet headers from the first row.
   */
  getHeaders(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = utils.sheet_to_json(ws, { header: 1 });
          resolve((rows[0] ?? []).map(String));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
}
