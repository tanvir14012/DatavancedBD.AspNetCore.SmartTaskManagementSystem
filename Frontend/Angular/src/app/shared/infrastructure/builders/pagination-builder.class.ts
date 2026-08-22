import { FluentBuilder } from '../../core';
import { IPaginationParams, PaginationStrategy, ICursorPaginationParams } from '../../core';

/**
 * Pagination builder for offset-based pagination
 */
export class PaginationBuilder extends FluentBuilder<IPaginationParams> {
  withPageNumber(pageNumber: number): this {
    return this.set('pageNumber', pageNumber);
  }

  withPageSize(pageSize: number): this {
    return this.set('pageSize', pageSize);
  }

  nextPage(): this {
    const current = this.get('pageNumber') || 1;
    return this.set('pageNumber', current + 1);
  }

  previousPage(): this {
    const current = this.get('pageNumber') || 1;
    if (current > 1) {
      return this.set('pageNumber', current - 1);
    }
    return this;
  }

  build(): IPaginationParams {
    return this.getConfig() as IPaginationParams;
  }
}

/**
 * Cursor pagination builder
 */
export class CursorPaginationBuilder extends FluentBuilder<ICursorPaginationParams> {
  withCursor(cursor?: string): this {
    return this.set('cursor', cursor);
  }

  withLimit(limit: number): this {
    return this.set('limit', limit);
  }

  build(): ICursorPaginationParams {
    return this.getConfig() as ICursorPaginationParams;
  }
}
