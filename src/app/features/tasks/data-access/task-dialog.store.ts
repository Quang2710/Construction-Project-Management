import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { UserSummary } from '../../../shared/models/user.model';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { SchedulingApiService } from '../../scheduling/data-access/scheduling-api.service';
import { WbsNode } from '../../scheduling/models/wbs.model';
import { Task, TaskComment, TaskCreateRequest, TaskUpdateRequest } from '../models/task.model';
import { ProjectOption } from './kanban.store';
import { TasksApiService } from './tasks-api.service';

interface TaskDialogState {
  /** null khi tạo mới. */
  readonly task: Task | null;
  readonly projects: ProjectOption[];
  readonly members: UserSummary[];
  readonly wbs: WbsNode[];
  readonly comments: TaskComment[];
  readonly loadingMembers: boolean;
  readonly loadingComments: boolean;
  readonly commentsError: string | null;
  readonly saving: boolean;
  readonly deleting: boolean;
  readonly sendingComment: boolean;
  readonly error: string | null;
}

const initialState: TaskDialogState = {
  task: null,
  projects: [],
  members: [],
  wbs: [],
  comments: [],
  loadingMembers: false,
  loadingComments: false,
  commentsError: null,
  saving: false,
  deleting: false,
  sendingComment: false,
  error: null,
};

export const TaskDialogStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _tasksApi: inject(TasksApiService),
    _projectsApi: inject(ProjectsApiService),
    _schedulingApi: inject(SchedulingApiService),
  })),
  withComputed(({ task, members }) => ({
    isEdit: computed(() => task() !== null),
    /** Giữ người phụ trách hiện tại trong danh sách kể cả khi đã rời dự án. */
    assigneeOptions: computed(() => {
      const assignee = task()?.assignee;
      const list = members();
      return assignee && !list.some((member) => member.id === assignee.id) ? [assignee, ...list] : list;
    }),
  })),
  withMethods((store) => {
    /** Thành viên (để giao việc) và cây WBS của dự án. */
    async function loadMembers(projectId: string): Promise<void> {
      patchState(store, { loadingMembers: true });
      const [members, wbs] = await Promise.allSettled([
        firstValueFrom(store._projectsApi.members(projectId)),
        firstValueFrom(store._schedulingApi.wbs(projectId)),
      ]);
      patchState(store, {
        members: members.status === 'fulfilled' ? members.value : [],
        wbs: wbs.status === 'fulfilled' ? wbs.value : [],
        loadingMembers: false,
      });
    }

    async function loadComments(taskId: string): Promise<void> {
      patchState(store, { loadingComments: true, commentsError: null });
      try {
        patchState(store, { comments: await firstValueFrom(store._tasksApi.comments(taskId)) });
      } catch (error) {
        patchState(store, { commentsError: toApiError(error).message });
      } finally {
        patchState(store, { loadingComments: false });
      }
    }

    return {
      loadMembers,
      loadComments,

      async init(task: Task | null, projectId: string | null): Promise<void> {
        patchState(store, { task });
        const currentProjectId = task?.projectId ?? projectId;
        if (task) {
          void loadComments(task.id);
        } else {
          try {
            const response = await firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' }));
            patchState(store, { projects: response.data.map(({ id, code, name }) => ({ id, code, name })) });
          } catch {
            patchState(store, { projects: [] });
          }
        }
        if (currentProjectId) {
          await loadMembers(currentProjectId);
        }
      },

      async create(body: TaskCreateRequest): Promise<Task | null> {
        patchState(store, { saving: true, error: null });
        try {
          const task = await firstValueFrom(store._tasksApi.create(body));
          patchState(store, { task, saving: false });
          return task;
        } catch (error) {
          patchState(store, { saving: false, error: toApiError(error).message });
          return null;
        }
      },

      async update(changes: TaskUpdateRequest): Promise<Task | null> {
        const current = store.task();
        if (!current) {
          return null;
        }
        patchState(store, { saving: true, error: null });
        try {
          const task = await firstValueFrom(store._tasksApi.update(current.id, changes));
          patchState(store, { task, saving: false });
          return task;
        } catch (error) {
          patchState(store, { saving: false, error: toApiError(error).message });
          return null;
        }
      },

      async remove(): Promise<boolean> {
        const current = store.task();
        if (!current) {
          return false;
        }
        patchState(store, { deleting: true, error: null });
        try {
          await firstValueFrom(store._tasksApi.remove(current.id));
          return true;
        } catch (error) {
          patchState(store, { error: toApiError(error).message });
          return false;
        } finally {
          patchState(store, { deleting: false });
        }
      },

      async addComment(content: string): Promise<boolean> {
        const current = store.task();
        if (!current) {
          return false;
        }
        patchState(store, { sendingComment: true });
        try {
          const comment = await firstValueFrom(store._tasksApi.addComment(current.id, content));
          patchState(store, {
            comments: [...store.comments(), comment],
            task: { ...current, commentCount: current.commentCount + 1 },
          });
          return true;
        } catch (error) {
          patchState(store, { commentsError: toApiError(error).message });
          return false;
        } finally {
          patchState(store, { sendingComment: false });
        }
      },
    };
  }),
);
