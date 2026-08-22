import { FluentBuilder } from '../../core';
import { ISort, ISortColumn, SortDirection } from '../../core';

/**
 * Sort builder for constructing sort configurations
 */
export class SortBuilder extends FluentBuilder<ISort> {
  private columns: ISortColumn[] = [];

  addColumn(field: string, direction: SortDirection = SortDirection.ASC): this {
    this.columns.push({ field, direction });
    return this;
  }

  asc(field: string): this {
    return this.addColumn(field, SortDirection.ASC);
  }

  desc(field: string): this {
    return this.addColumn(field, SortDirection.DESC);
  }

  clearColumns(): this {
    this.columns = [];
    return this;
  }

  build(): ISort {
    return { columns: this.columns };
  }
}
