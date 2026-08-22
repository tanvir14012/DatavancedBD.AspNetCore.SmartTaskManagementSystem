/**
 * Pagination types and interfaces
 */

export interface IPaginationParams {
  pageNumber: number;
  pageSize: number;
}

export interface ICursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface IPaginatedResponse<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ICursorPaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
}

export enum PaginationStrategy {
  OFFSET = 'offset',
  CURSOR = 'cursor',
}
