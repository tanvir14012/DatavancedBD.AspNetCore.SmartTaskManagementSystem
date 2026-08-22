/**
 * Sort types and interfaces
 */

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface ISortColumn {
  field: string;
  direction: SortDirection;
}

export interface ISort {
  columns: ISortColumn[];
}

export type SortComparator<T> = (a: T, b: T) => number;
