import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../../shared/utils/api-error';
import { Project } from '../models/project.model';
import { ProjectsApiService } from './projects-api.service';

interface ProjectDetailState {
  readonly project: Project | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly deleting: boolean;
}

export const ProjectDetailStore = signalStore(
  withState<ProjectDetailState>({ project: null, loading: false, error: null, deleting: false }),
  withProps(() => ({ _api: inject(ProjectsApiService) })),
  withMethods((store) => ({
    async load(id: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const project = await firstValueFrom(store._api.get(id));
        patchState(store, { project, loading: false });
      } catch (error) {
        patchState(store, { project: null, loading: false, error: toApiError(error).message });
      }
    },

    /** Tải lại ngầm (không hiện loading) sau khi công việc thay đổi. */
    async refresh(): Promise<void> {
      const current = store.project();
      if (!current) {
        return;
      }
      try {
        patchState(store, { project: await firstValueFrom(store._api.get(current.id)) });
      } catch {
        // Giữ dữ liệu cũ nếu làm mới thất bại.
      }
    },

    async remove(): Promise<boolean> {
      const current = store.project();
      if (!current) {
        return false;
      }
      patchState(store, { deleting: true });
      try {
        await firstValueFrom(store._api.remove(current.id));
        return true;
      } catch {
        return false;
      } finally {
        patchState(store, { deleting: false });
      }
    },
  })),
);
