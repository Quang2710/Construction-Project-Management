import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Project } from '../../projects/models/project.model';
import { TasksApiService } from '../../tasks/data-access/tasks-api.service';
import { Task, TaskUpdateRequest } from '../../tasks/models/task.model';
import { WbsNode } from '../models/wbs.model';
import { computeCriticalPath } from '../utils/critical-path';
import { buildGanttItems } from '../utils/gantt-items';
import { SchedulingApiService } from './scheduling-api.service';

export type ScheduleViewType = 'day' | 'week' | 'month' | 'quarter';

interface ScheduleState {
  readonly projects: Project[];
  readonly projectId: string | null;
  readonly tasks: Task[];
  readonly wbs: WbsNode[];
  readonly viewType: ScheduleViewType;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
}

export const ScheduleStore = signalStore(
  withState<ScheduleState>({
    projects: [],
    projectId: null,
    tasks: [],
    wbs: [],
    viewType: 'week',
    loading: false,
    saving: false,
    error: null,
  }),
  withProps(() => ({
    _projectsApi: inject(ProjectsApiService),
    _tasksApi: inject(TasksApiService),
    _schedulingApi: inject(SchedulingApiService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => {
    const cpm = computed(() => computeCriticalPath(store.tasks()));
    const canEdit = computed(() => store._auth.hasAnyRole(PERMISSIONS.editTasks));
    return {
      cpm,
      canEdit,
      canManageWbs: computed(() => store._auth.hasAnyRole(PERMISSIONS.manageProjects)),
      project: computed(() => store.projects().find((project) => project.id === store.projectId()) ?? null),
      items: computed(() => buildGanttItems(store.wbs(), store.tasks(), cpm(), canEdit())),
      stats: computed(() => ({
        total: store.tasks().length,
        critical: cpm().critical.size,
        milestones: store.tasks().filter((task) => task.isMilestone).length,
        violations: cpm().violations.size,
        finishDate: cpm().finishDate,
      })),
    };
  }),
  withMethods((store) => {
    async function loadSchedule(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { loading: true, error: null });
      try {
        const [tasks, wbs] = await Promise.all([
          firstValueFrom(store._tasksApi.list({ projectId, pageSize: 500, sort: 'startDate' })),
          firstValueFrom(store._schedulingApi.wbs(projectId)),
        ]);
        // Bỏ kết quả cũ nếu người dùng đã chuyển dự án trong lúc tải.
        if (store.projectId() === projectId) {
          patchState(store, { tasks: tasks.data, wbs, loading: false });
        }
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    }

    /** PATCH rồi tải lại toàn bộ lịch (BE có thể đã dời các công việc phía sau). */
    async function patchTask(taskId: string, changes: TaskUpdateRequest, success: string): Promise<boolean> {
      patchState(store, { saving: true });
      try {
        await firstValueFrom(store._tasksApi.update(taskId, changes));
        store._notification.success(success);
        return true;
      } catch (error) {
        // 0/401/403 đã được errorInterceptor thông báo.
        if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
          store._notification.error(toApiError(error).message);
        }
        return false;
      } finally {
        patchState(store, { saving: false });
        await loadSchedule();
      }
    }

    return {
      loadSchedule,

      async init(preferredProjectId: string | null): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const response = await firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' }));
          const projects = response.data.filter((project) => project.status !== 'CANCELLED');
          const fallback = projects.find((project) => project.status === 'IN_PROGRESS') ?? projects[0];
          const projectId = projects.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : (fallback?.id ?? null);
          patchState(store, { projects, projectId, loading: false });
          await loadSchedule();
        } catch (error) {
          patchState(store, { loading: false, error: toApiError(error).message });
        }
      },

      async setProject(projectId: string): Promise<void> {
        patchState(store, { projectId, tasks: [], wbs: [] });
        await loadSchedule();
      },

      setViewType(viewType: ScheduleViewType): void {
        patchState(store, { viewType });
      },

      reschedule(taskId: string, startDate: string, dueDate: string): Promise<boolean> {
        const task = store.tasks().find((item) => item.id === taskId);
        if (!task || (task.startDate === startDate && task.dueDate === dueDate)) {
          return Promise.resolve(false);
        }
        return patchTask(taskId, { startDate, dueDate }, `Đã dời "${task.title}".`);
      },

      addDependency(predecessorId: string, successorId: string): Promise<boolean> {
        const successor = store.tasks().find((task) => task.id === successorId);
        if (!successor || predecessorId === successorId || successor.dependencyIds.includes(predecessorId)) {
          return Promise.resolve(false);
        }
        return patchTask(
          successorId,
          { dependencyIds: [...successor.dependencyIds, predecessorId] },
          'Đã thêm liên kết phụ thuộc.',
        );
      },

      removeDependency(predecessorId: string, successorId: string): Promise<boolean> {
        const successor = store.tasks().find((task) => task.id === successorId);
        if (!successor) {
          return Promise.resolve(false);
        }
        return patchTask(
          successorId,
          { dependencyIds: successor.dependencyIds.filter((id) => id !== predecessorId) },
          'Đã xoá liên kết phụ thuộc.',
        );
      },

      async createWbs(name: string, parentId: string | null): Promise<boolean> {
        const projectId = store.projectId();
        if (!projectId) {
          return false;
        }
        try {
          await firstValueFrom(store._schedulingApi.createWbs(projectId, { name, parentId }));
          store._notification.success(`Đã thêm hạng mục "${name}".`);
          await loadSchedule();
          return true;
        } catch (error) {
          store._notification.error(toApiError(error).message);
          return false;
        }
      },
    };
  }),
);
