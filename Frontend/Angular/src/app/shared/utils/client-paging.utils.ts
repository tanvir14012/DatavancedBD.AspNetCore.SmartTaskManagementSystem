import { PagedResult } from '../models/paged-result.model';
import { QueryParams } from '../models/query-params.model';

function normalizeValue(value: unknown): string | number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value ?? '').toLowerCase();
}

export function toClientPagedResult<T extends { id: string }>(
  items: T[],
  query: QueryParams,
  searchableKeys: Array<keyof T>,
): PagedResult<T> {
  const search = query.search?.trim().toLowerCase() ?? '';
  const filtered = search
    ? items.filter((item) =>
        searchableKeys.some((key) =>
          String(item[key] ?? '')
            .toLowerCase()
            .includes(search),
        ),
      )
    : [...items];

  const sortBy = query.sortBy as keyof T | undefined;
  if (sortBy) {
    filtered.sort((left, right) => {
      const leftValue = normalizeValue(left[sortBy]);
      const rightValue = normalizeValue(right[sortBy]);

      if (leftValue < rightValue) return query.sortDirection === 'desc' ? 1 : -1;
      if (leftValue > rightValue) return query.sortDirection === 'desc' ? -1 : 1;
      return 0;
    });
  }

  const pageSize = query.pageSize ?? 10;
  const page = query.page ?? 1;
  const totalCount = filtered.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const start = Math.max(0, (page - 1) * pageSize);
  const pagedItems = filtered.slice(start, start + pageSize);

  return {
    items: pagedItems,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
