import { PopulateOptions, Query } from 'mongoose';

export type ModelQuery<T> = Query<unknown, T>;
export type QueryParams = Record<string, unknown>;

export interface RangeFilterConfig {
  field: string;
  minKey?: string;
  maxKey?: string;
  type?: 'number' | 'date';
}
export type QueryField<T> = Extract<keyof T, string> | string;

export interface FilterConfig {
  searchableFields?: string[];
  filterableFields?: string[];
  sortableFields?: string[];
  selectableFields?: string[];
  numberFields?: string[];
  booleanFields?: string[];
  objectIdFields?: string[];
  arrayFields?: string[];
  enumFields?: string[];
  rangeFields?: RangeFilterConfig[];
  populate?: PopulateOptions[];
  defaultSort?: string;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  skip: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
}
