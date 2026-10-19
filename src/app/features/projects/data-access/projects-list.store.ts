import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import { toApiError } from '../../../shared/utils/api-error';
import { Project, ProjectListParams, ProjectStatus } from '../models/project.model';
import { ProjectsApiService } from './projects-api.service';

interface ProjectsListState {
  readonly items: Project[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly q: string;
  readonly status: ProjectStatus | null;
  readonly sort: string;
  readonly loading: boolean;
  readonly error: string | null;
  /** Tăng để buộc tải lại với cùng bộ lọc (nút "Thử lại"). */
  readonly reloadKey: number;
}

const initialState: ProjectsListState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  q: '',
  status: null,
  sort: 'code',
  loading: false,
  error: null,
  reloadKey: 0,
};

export const ProjectsListStore = signalStore(
  withState(initialState),
  withProps(() => ({ _api: inject(ProjectsApiService) })),
  withComputed(({ items, loading, error, page, pageSize, q, status, sort, reloadKey }) => ({
    isEmpty: computed(() => !loading() && !error() && items().length === 0),
    query: computed<ProjectListParams & { reloadKey: number }>(() => ({
      page: page(),
      pageSize: pageSize(),
      q: q(),
      status: status(),
      sort: sort(),
      reloadKey: reloadKey(),
    })),
  })),
  withMethods((store) => ({
    setSearch(q: string): void {
      patchState(store, { q: q.trim(), page: 1 });
    },
    setStatus(status: ProjectStatus | null): void {
      patchState(store, { status, page: 1 });
    },
    setPage(page: number, pageSize: number): void {
      patchState(store, { page, pageSize });
    },
    setSort(field: string, direction: 'asc' | 'desc' | ''): void {
      patchState(store, { sort: direction === '' ? 'code' : direction === 'desc' ? `-${field}` : field, page: 1 });
    },
    reload(): void {
      patchState(store, { reloadKey: store.reloadKey() + 1 });
    },
    _load: rxMethod<ProjectListParams & { reloadKey: number }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ reloadKey: _reloadKey, ...params }) =>
          store._api.list(params).pipe(
            tap((response) => patchState(store, { items: response.data, total: response.total, loading: false })),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: toApiError(error).message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      // Mỗi khi bộ lọc/trang thay đổi, tự gọi lại API (switchMap huỷ request cũ).
      store._load(store.query);
    },
  }),
);
