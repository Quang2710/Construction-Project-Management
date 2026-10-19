export interface ApiError {
  readonly code: string;
  readonly message: string;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export type SortDirection = 'asc' | 'desc';

export interface ListParams {
  readonly page?: number;
  readonly pageSize?: number;
  /** "field" để tăng dần, "-field" để giảm dần. */
  readonly sort?: string;
  readonly q?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['code'] === 'string' &&
    typeof (value as Record<string, unknown>)['message'] === 'string'
  );
}
