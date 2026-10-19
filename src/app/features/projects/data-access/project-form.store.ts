import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { UsersApiService } from '../../../shared/data-access/users-api.service';
import { User } from '../../../shared/models/user.model';
import { toApiError } from '../../../shared/utils/api-error';
import { Project, ProjectUpsertRequest } from '../models/project.model';
import { ProjectsApiService } from './projects-api.service';

export type SaveResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly code: string; readonly message: string };

interface ProjectFormState {
  /** null khi tạo mới. */
  readonly project: Project | null;
  readonly managers: User[];
  readonly engineers: User[];
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
}

export const ProjectFormStore = signalStore(
  withState<ProjectFormState>({
    project: null,
    managers: [],
    engineers: [],
    loading: false,
    saving: false,
    error: null,
  }),
  withProps(() => ({
    _projectsApi: inject(ProjectsApiService),
    _usersApi: inject(UsersApiService),
  })),
  withComputed(({ project }) => ({
    isEdit: computed(() => project() !== null),
  })),
  withMethods((store) => ({
    /** Nạp danh sách người dùng cho các ô chọn và (khi sửa) dữ liệu dự án. */
    async init(projectId: string | null): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const [managers, engineers, project] = await Promise.all([
          firstValueFrom(store._usersApi.list({ role: 'PROJECT_MANAGER', active: true, pageSize: 100, sort: 'fullName' })),
          firstValueFrom(store._usersApi.list({ role: 'SITE_ENGINEER', active: true, pageSize: 100, sort: 'fullName' })),
          projectId ? firstValueFrom(store._projectsApi.get(projectId)) : Promise.resolve(null),
        ]);
        patchState(store, { managers: managers.data, engineers: engineers.data, project, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    },

    async save(body: ProjectUpsertRequest): Promise<SaveResult> {
      const current = store.project();
      patchState(store, { saving: true });
      try {
        const request = current ? store._projectsApi.update(current.id, body) : store._projectsApi.create(body);
        const project = await firstValueFrom(request);
        patchState(store, { project, saving: false });
        return { ok: true, project };
      } catch (error) {
        patchState(store, { saving: false });
        const apiError = toApiError(error);
        return {
          ok: false,
          code: error instanceof HttpErrorResponse ? apiError.code : 'UNKNOWN',
          message: apiError.message,
        };
      }
    },
  })),
);
