import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { addMonths } from 'date-fns';
import { catchError, EMPTY, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { toApiError } from '../../../shared/utils/api-error';
import { todayIso } from '../../../shared/utils/date.utils';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Project } from '../../projects/models/project.model';
import { DIARY_STATUSES, DiaryStatus, SiteDiary } from '../models/site-diary.model';
import { buildMonthGrid, CalendarDay, formatMonth, gridRange, parseMonth } from '../utils/calendar.utils';
import { SiteDiariesApiService } from './site-diaries-api.service';

export interface CalendarCell extends CalendarDay {
  readonly diaries: readonly SiteDiary[];
  /** Ngày làm việc đã qua mà dự án đang lọc chưa có nhật ký. */
  readonly missing: boolean;
}

interface DiaryCalendarState {
  /** yyyy-MM */
  readonly month: string;
  readonly projectId: string | null;
  readonly status: DiaryStatus | null;
  readonly selectedDate: string;
  readonly diaries: SiteDiary[];
  readonly projects: Project[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly reloadKey: number;
}

export const DiaryCalendarStore = signalStore(
  withState<DiaryCalendarState>(() => ({
    month: formatMonth(new Date()),
    projectId: null,
    status: null,
    selectedDate: todayIso(),
    diaries: [],
    projects: [],
    loading: false,
    error: null,
    reloadKey: 0,
  })),
  withProps(() => ({
    _diariesApi: inject(SiteDiariesApiService),
    _projectsApi: inject(ProjectsApiService),
  })),
  withComputed((store) => {
    const selectedProject = computed(() => store.projects().find((project) => project.id === store.projectId()) ?? null);
    const byDate = computed(() => {
      const map = new Map<string, SiteDiary[]>();
      for (const diary of store.diaries()) {
        map.set(diary.date, [...(map.get(diary.date) ?? []), diary]);
      }
      return map;
    });

    return {
      selectedProject,
      weeks: computed<CalendarCell[][]>(() => {
        const today = todayIso();
        const project = selectedProject();
        // Chỉ cảnh báo thiếu nhật ký khi xem một dự án đang thi công, không lọc trạng thái.
        const checkMissing = project !== null && project.status === 'IN_PROGRESS' && store.status() === null;
        const diariesByDate = byDate();
        return buildMonthGrid(store.month(), today).map((week) =>
          week.map((day) => {
            const diaries = diariesByDate.get(day.date) ?? [];
            const missing =
              checkMissing &&
              diaries.length === 0 &&
              !day.isSunday &&
              day.date < today &&
              day.date >= (project?.startDate ?? '') &&
              day.date <= (project?.endDate ?? '');
            return { ...day, diaries, missing };
          }),
        );
      }),
      selectedDiaries: computed(() => byDate().get(store.selectedDate()) ?? []),
      monthLabel: computed(() => {
        const date = parseMonth(store.month());
        return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
      }),
      statusCounts: computed(() =>
        DIARY_STATUSES.map((status) => ({
          status,
          count: store.diaries().filter((diary) => diary.status === status && diary.date.startsWith(store.month())).length,
        })),
      ),
      query: computed(() => ({
        ...gridRange(store.month()),
        projectId: store.projectId(),
        status: store.status(),
        reloadKey: store.reloadKey(),
      })),
    };
  }),
  withMethods((store) => ({
    setMonth(month: string): void {
      patchState(store, { month });
    },
    shiftMonth(delta: number): void {
      patchState(store, { month: formatMonth(addMonths(parseMonth(store.month()), delta)) });
    },
    goToToday(): void {
      patchState(store, { month: formatMonth(new Date()), selectedDate: todayIso() });
    },
    setProject(projectId: string | null): void {
      patchState(store, { projectId });
    },
    setStatus(status: DiaryStatus | null): void {
      patchState(store, { status });
    },
    selectDate(selectedDate: string): void {
      patchState(store, { selectedDate });
    },
    reload(): void {
      patchState(store, { reloadKey: store.reloadKey() + 1 });
    },

    _load: rxMethod<{ from: string; to: string; projectId: string | null; status: DiaryStatus | null; reloadKey: number }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ reloadKey: _reloadKey, ...params }) =>
          store._diariesApi.list({ ...params, pageSize: 500, sort: 'date' }).pipe(
            tap((response) => patchState(store, { diaries: response.data, loading: false })),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: toApiError(error).message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),

    async _loadProjects(): Promise<void> {
      try {
        const response = await firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' }));
        patchState(store, { projects: response.data });
      } catch {
        // Bộ lọc dự án chỉ là tiện ích.
      }
    },
  })),
  withHooks({
    onInit(store) {
      void store._loadProjects();
      store._load(store.query);
    },
  }),
);
