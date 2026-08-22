import { Injectable } from '@angular/core';
import { TableExportValue } from '../components/data-table/data-table.model';
import { TableExportTemplateDto } from '../models/template-dto.model';

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  async exportTable<T extends { id: string }>(template: TableExportTemplateDto<T>): Promise<void> {
    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const exportableColumns = template.columns.filter((col) => !col.excludeFromPdf);
    const headers = exportableColumns.map((col) =>
      template.resolveHeader ? template.resolveHeader(col.headerKey) : col.headerKey,
    );
    const body = template.rows.map((row) =>
      exportableColumns.map((col) => {
        const value: TableExportValue = col.pdfRender
          ? col.pdfRender(row)
          : (row as Record<string, TableExportValue>)[col.key as string];
        return this.formatValue(value);
      }),
    );

    const doc = new JsPdf({
      orientation: template.orientation ?? 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    let startY = 40;
    doc.setFontSize(14);
    doc.text(template.title, 40, startY);
    startY += 18;

    if (template.subtitle) {
      doc.setFontSize(10);
      doc.text(template.subtitle, 40, startY);
      startY += 14;
    }

    autoTable(doc, {
      head: [headers],
      body,
      startY,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 118, 110] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`${template.fileName}.pdf`);
  }

  private formatValue(value: TableExportValue): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }
}
