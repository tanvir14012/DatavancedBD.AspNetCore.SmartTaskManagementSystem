export type SortDirection = 'asc' | 'desc' | '';

export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  search?: string;
  filters?: FilterParam[];
}

export interface FilterParam {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | null;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'between';

export function toHttpParams(params: QueryParams): Record<string, string> {
  const result: Record<string, string> = {};
  if (params.page != null) result['page'] = String(params.page);
  if (params.pageSize != null) result['pageSize'] = String(params.pageSize);
  if (params.sortBy) result['sortBy'] = params.sortBy;
  if (params.sortDirection) result['sortDirection'] = params.sortDirection;
  if (params.search) result['search'] = params.search;
  if (params.filters?.length) {
    params.filters.forEach((f, i) => {
      result[`filters[${i}].field`] = f.field;
      result[`filters[${i}].operator`] = f.operator;
      result[`filters[${i}].value`] = String(f.value ?? '');
    });
  }
  return result;
}
