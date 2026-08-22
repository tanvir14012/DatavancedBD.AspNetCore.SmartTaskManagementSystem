/**
 * Filter types and interfaces
 */

export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'nin',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'notContains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  BETWEEN = 'between',
  IS_NULL = 'isNull',
  IS_NOT_NULL = 'isNotNull',
  REGEX = 'regex',
}

export enum FilterLogic {
  AND = 'and',
  OR = 'or',
}

export interface IFilterCondition {
  field: string;
  operator: FilterOperator;
  value?: any;
  caseSensitive?: boolean;
}

export interface IFilterGroup {
  logic: FilterLogic;
  conditions: (IFilterCondition | IFilterGroup)[];
}

export type FilterPredicate<T> = (item: T) => boolean;
