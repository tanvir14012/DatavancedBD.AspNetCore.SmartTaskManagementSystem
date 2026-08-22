import { FluentBuilder } from '../../core';
import { IFilterGroup, ISort, IPaginationParams } from '../../core';

/**
 * Query builder combining filters, sort, and pagination
 */
export class QueryBuilder<T> extends FluentBuilder<{
  filters?: IFilterGroup;
  sort?: ISort;
  pagination?: IPaginationParams;
}> {
  withFilters(filters: IFilterGroup): this {
    return this.set('filters', filters);
  }

  withSort(sort: ISort): this {
    return this.set('sort', sort);
  }

  withPagination(pagination: IPaginationParams): this {
    return this.set('pagination', pagination);
  }

  build() {
    return this.getConfig();
  }
}
