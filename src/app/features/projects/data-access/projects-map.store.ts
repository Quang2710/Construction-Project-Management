import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../../shared/utils/api-error';
import { Project, ProjectStatus } from '../models/project.model';
import { ProjectsApiService } from './projects-api.service';

interface ProjectsMapState {
  readonly projects: Project[];
  readonly selectedId: string | null;
  readonly statusFilter: ProjectStatus | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const ProjectsMapStore = signalStore(
  withState<ProjectsMapState>({ projects: [], selectedId: null, statusFilter: null, loading: false, error: null }),
  withProps(() => ({ _api: inject(ProjectsApiService) })),
  withComputed(({ projects, selectedId, statusFilter }) => ({
    filtered: computed(() => {
      const status = statusFilter();
      return status ? projects().filter((project) => project.status === status) : projects();
    }),
    selected: computed(() => projects().find((project) => project.id === selectedId()) ?? null),
  })),
  withMethods((store) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(store._api.list({ pageSize: 100, sort: 'code' }));
        patchState(store, { projects: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    },
    select(selectedId: string | null): void {
      patchState(store, { selectedId });
    },
    setStatusFilter(statusFilter: ProjectStatus | null): void {
      patchState(store, { statusFilter, selectedId: null });
    },
  })),
  withHooks({
    onInit(store) {
      void store.load();
    },
  }),
);
