import { TableColumn } from '../components/data-table/data-table.model';

export type PdfOrientation = 'portrait' | 'landscape';

export interface TableExportTemplateDto<T extends { id: string }> {
  fileName: string;
  title: string;
  subtitle?: string;
  rows: T[];
  columns: TableColumn<T>[];
  orientation?: PdfOrientation;
  resolveHeader?: (headerKey: string) => string;
}
