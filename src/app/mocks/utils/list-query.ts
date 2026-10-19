import { PaginatedResponse, SortDirection } from '../../shared/models/api.model';
import { removeVietnameseTones } from '../../shared/utils/string.utils';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const RESERVED_PARAMS = new Set(['page', 'pageSize', 'sort', 'q']);

export interface ListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: { readonly field: string; readonly direction: SortDirection } | null;
  readonly q: string;
  /** Các query param còn lại được coi là bộ lọc theo field (?status=ACTIVE,PAUSED). */
  readonly filters: Readonly<Record<string, readonly string[]>>;
}

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readField(item: object, field: string): unknown {
  return (item as Record<string, unknown>)[field];
}

function normalize(value: string): string {
  return removeVietnameseTones(value).toLowerCase();
}

/**
 * Đọc ?page=&pageSize=&sort=&q= và các bộ lọc từ URL.
 * sort: "field" (tăng dần) hoặc "-field" (giảm dần).
 */
export function parseListQuery(url: URL, options: { readonly maxPageSize?: number } = {}): ListQuery {
  const params = url.searchParams;
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;
  const rawSort = params.get('sort')?.trim() ?? '';
  const filters: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (!RESERVED_PARAMS.has(key) && value !== '') {
      filters[key] = [...(filters[key] ?? []), ...value.split(',')];
    }
  });

  return {
    page: toPositiveInt(params.get('page'), 1),
    pageSize: Math.min(toPositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE), maxPageSize),
    sort: rawSort
      ? {
          field: rawSort.replace(/^-/, ''),
          direction: rawSort.startsWith('-') ? 'desc' : 'asc',
        }
      : null,
    q: params.get('q')?.trim() ?? '',
    filters,
  };
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  return String(a ?? '').localeCompare(String(b ?? ''), 'vi', { numeric: true });
}

/** Áp dụng tìm kiếm, lọc, sắp xếp và phân trang lên một danh sách. */
export function applyListQuery<T extends object>(
  items: readonly T[],
  query: ListQuery,
  searchFields: readonly (keyof T & string)[],
): PaginatedResponse<T> {
  const keyword = normalize(query.q);

  let result = items.filter((item) =>
    Object.entries(query.filters).every(([field, values]) => {
      const fieldValue = readField(item, field);
      return fieldValue === undefined || values.includes(String(fieldValue));
    }),
  );

  if (keyword) {
    result = result.filter((item) =>
      searchFields.some((field) => normalize(String(readField(item, field) ?? '')).includes(keyword)),
    );
  }

  const sort = query.sort;
  if (sort) {
    const factor = sort.direction === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => factor * compareValues(readField(a, sort.field), readField(b, sort.field)));
  }

  const start = (query.page - 1) * query.pageSize;
  return {
    data: result.slice(start, start + query.pageSize),
    total: result.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}
