import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../../shared/utils/api-error';
import { Task, TASK_STATUSES, TaskStatus } from '../models/task.model';
import { TasksApiService } from './tasks-api.service';

interface ProjectTasksState {
  readonly projectId: string | null;
  readonly tasks: Task[];
  readonly loading: boolean;
  readonly error: string | null;
}

const STATUS_RANK: Readonly<Record<TaskStatus, number>> = { IN_PROGRESS: 0, REVIEW: 1, TODO: 2, DONE: 3 };

/** Danh sách công việc của một dự án (tab "Công việc" trong chi tiết dự án). */
export const ProjectTasksStore = signalStore(
  withState<ProjectTasksState>({ projectId: null, tasks: [], loading: false, error: null }),
  withProps(() => ({ _api: inject(TasksApiService) })),
  withComputed(({ tasks, loading, error }) => ({
    sortedTasks: computed(() =>
      [...tasks()].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.dueDate.localeCompare(b.dueDate)),
    ),
    countByStatus: computed(() =>
      TASK_STATUSES.map((status) => ({ status, count: tasks().filter((task) => task.status === status).length })),
    ),
    isEmpty: computed(() => !loading() && !error() && tasks().length === 0),
  })),
  withMethods((store) => ({
    async load(projectId: string): Promise<void> {
      patchState(store, { projectId, loading: true, error: null });
      try {
        const response = await firstValueFrom(store._api.list({ projectId, pageSize: 500 }));
        patchState(store, { tasks: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    },
    upsert(task: Task): void {
      const exists = store.tasks().some((item) => item.id === task.id);
      patchState(store, {
        tasks: exists ? store.tasks().map((item) => (item.id === task.id ? task : item)) : [...store.tasks(), task],
      });
    },
    remove(taskId: string): void {
      patchState(store, { tasks: store.tasks().filter((task) => task.id !== taskId) });
    },
  })),
);
