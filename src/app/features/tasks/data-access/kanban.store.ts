import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/notifications/notification.service';
import { removeVietnameseTones } from '../../../shared/utils/string.utils';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Task, TASK_STATUSES, TaskStatus } from '../models/task.model';
import { orderBetween } from '../utils/task.utils';
import { TasksApiService } from './tasks-api.service';

const MAX_TASKS = 500;

export interface ProjectOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export type KanbanColumns = Readonly<Record<TaskStatus, readonly Task[]>>;

interface KanbanState {
  readonly tasks: Task[];
  readonly projects: ProjectOption[];
  readonly projectId: string | null;
  readonly onlyMine: boolean;
  readonly q: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly reloadKey: number;
  /** Task đang chờ BE xác nhận sau khi kéo thả. */
  readonly pendingIds: string[];
}

const initialState: KanbanState = {
  tasks: [],
  projects: [],
  projectId: null,
  onlyMine: false,
  q: '',
  loading: false,
  error: null,
  reloadKey: 0,
  pendingIds: [],
};

function normalize(value: string): string {
  return removeVietnameseTones(value).toLowerCase();
}

export const KanbanStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _tasksApi: inject(TasksApiService),
    _projectsApi: inject(ProjectsApiService),
    _auth: inject(AuthStore),
    _notification: inject(NotificationService),
  })),
  withComputed((store) => {
    // Lọc theo từ khoá ở client để gõ là thấy ngay, không chờ API.
    const visibleTasks = computed(() => {
      const keyword = normalize(store.q().trim());
      if (!keyword) {
        return store.tasks();
      }
      return store.tasks().filter((task) =>
        [task.title, task.project.code, task.assignee?.fullName ?? '', ...task.labels].some((field) =>
          normalize(field).includes(keyword),
        ),
      );
    });

    return {
      visibleTasks,
      columns: computed<KanbanColumns>(() => {
        const groups: Record<TaskStatus, Task[]> = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
        for (const task of visibleTasks()) {
          groups[task.status].push(task);
        }
        for (const status of TASK_STATUSES) {
          groups[status].sort((a, b) => a.order - b.order);
        }
        return groups;
      }),
      isEmpty: computed(() => !store.loading() && !store.error() && store.tasks().length === 0),
      query: computed(() => ({
        projectId: store.projectId(),
        assigneeId: store.onlyMine() ? (store._auth.user()?.id ?? null) : null,
        reloadKey: store.reloadKey(),
      })),
    };
  }),
  withMethods((store) => ({
    setProject(projectId: string | null): void {
      patchState(store, { projectId });
    },
    setOnlyMine(onlyMine: boolean): void {
      patchState(store, { onlyMine });
    },
    setSearch(q: string): void {
      patchState(store, { q });
    },
    reload(): void {
      patchState(store, { reloadKey: store.reloadKey() + 1 });
    },

    /** Cập nhật/chèn task sau khi lưu từ dialog. */
    upsertTask(task: Task): void {
      const exists = store.tasks().some((item) => item.id === task.id);
      patchState(store, {
        tasks: exists ? store.tasks().map((item) => (item.id === task.id ? task : item)) : [...store.tasks(), task],
      });
    },

    removeTask(id: string): void {
      patchState(store, { tasks: store.tasks().filter((task) => task.id !== id) });
    },

    /**
     * Kéo thả: cập nhật lạc quan (UI đổi ngay), PATCH /tasks/:id, lỗi thì hoàn tác.
     * targetIndex là vị trí trong cột đích (đã bỏ task đang kéo).
     */
    async moveTask(taskId: string, targetStatus: TaskStatus, targetIndex: number): Promise<void> {
      const snapshot = store.tasks();
      const task = snapshot.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const target = store.columns()[targetStatus].filter((item) => item.id !== taskId);
      const order = orderBetween(target[targetIndex - 1]?.order, target[targetIndex]?.order);
      if (task.status === targetStatus && task.order === order) {
        return;
      }

      const percentComplete =
        targetStatus === 'DONE' ? 100 : task.status === 'DONE' ? 90 : task.percentComplete;
      const optimistic: Task = { ...task, status: targetStatus, order, percentComplete };
      patchState(store, {
        tasks: snapshot.map((item) => (item.id === taskId ? optimistic : item)),
        pendingIds: [...store.pendingIds(), taskId],
      });

      try {
        const saved = await firstValueFrom(store._tasksApi.update(taskId, { status: targetStatus, order }));
        patchState(store, { tasks: store.tasks().map((item) => (item.id === taskId ? saved : item)) });
      } catch (error) {
        patchState(store, { tasks: store.tasks().map((item) => (item.id === taskId ? task : item)) });
        // 0/401/403 đã được errorInterceptor thông báo, tránh hiện hai snackbar.
        const handledGlobally = error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status);
        if (!handledGlobally) {
          store._notification.error(`Không thể cập nhật "${task.title}": ${toApiError(error).message}`);
        }
      } finally {
        patchState(store, { pendingIds: store.pendingIds().filter((id) => id !== taskId) });
      }
    },

    _loadTasks: rxMethod<{ projectId: string | null; assigneeId: string | null; reloadKey: number }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ projectId, assigneeId }) =>
          store._tasksApi.list({ projectId, assigneeId, pageSize: MAX_TASKS }).pipe(
            tap((response) => patchState(store, { tasks: response.data, loading: false })),
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
        patchState(store, {
          projects: response.data.map(({ id, code, name }) => ({ id, code, name })),
        });
      } catch {
        // Bộ lọc dự án chỉ là tiện ích; bảng Kanban vẫn hoạt động.
      }
    },
  })),
  withHooks({
    onInit(store) {
      void store._loadProjects();
      store._loadTasks(store.query);
    },
  }),
);
