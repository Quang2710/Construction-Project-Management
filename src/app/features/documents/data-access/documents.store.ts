import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { UploadsApiService } from '../../../shared/data-access/uploads-api.service';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Project } from '../../projects/models/project.model';
import { Discipline, Drawing, DrawingCreateRequest, DrawingFile } from '../models/document.model';
import { DocumentsApiService } from './documents-api.service';

const PAGE_SIZE = 20;

export type DrawingDraft = Omit<DrawingCreateRequest, 'file'>;

interface DocumentsState {
  readonly projects: Project[];
  readonly projectId: string | null;
  readonly projectsLoading: boolean;
  readonly projectsError: string | null;
  readonly drawings: Drawing[];
  readonly total: number;
  readonly page: number;
  readonly discipline: Discipline | null;
  readonly query: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly uploading: boolean;
}

/** Tải PDF lên kho file rồi trả về tham chiếu DrawingFile cho API bản vẽ. */
export async function uploadDrawingFile(uploads: UploadsApiService, file: File): Promise<DrawingFile> {
  const uploaded = await firstValueFrom(uploads.upload(file, file.name));
  return { fileId: uploaded.id, url: uploaded.url, fileName: uploaded.fileName, size: uploaded.size };
}

export const DocumentsStore = signalStore(
  withState<DocumentsState>({
    projects: [],
    projectId: null,
    projectsLoading: false,
    projectsError: null,
    drawings: [],
    total: 0,
    page: 1,
    discipline: null,
    query: '',
    loading: false,
    error: null,
    uploading: false,
  }),
  withProps(() => ({
    _api: inject(DocumentsApiService),
    _projectsApi: inject(ProjectsApiService),
    _uploads: inject(UploadsApiService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => ({
    pageSize: computed(() => PAGE_SIZE),
    project: computed(() => store.projects().find((project) => project.id === store.projectId()) ?? null),
    canManage: computed(() => store._auth.hasAnyRole(PERMISSIONS.manageDocuments)),
  })),
  withMethods((store) => {
    async function load(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(
          store._api.drawings(projectId, {
            discipline: store.discipline(),
            q: store.query().trim(),
            page: store.page(),
            pageSize: PAGE_SIZE,
          }),
        );
        if (store.projectId() === projectId) {
          patchState(store, { drawings: response.data, total: response.total, loading: false });
        }
      } catch (error) {
        if (store.projectId() === projectId) {
          patchState(store, { loading: false, error: toApiError(error).message });
        }
      }
    }

    return {
      load,

      async init(preferredProjectId: string | null): Promise<void> {
        patchState(store, { projectsLoading: true, projectsError: null });
        try {
          const response = await firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' }));
          const projects = response.data.filter((project) => project.status !== 'CANCELLED');
          const fallback = projects.find((project) => project.status === 'IN_PROGRESS') ?? projects[0];
          const projectId = projects.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : (fallback?.id ?? null);
          patchState(store, { projects, projectId, projectsLoading: false });
          await load();
        } catch (error) {
          patchState(store, { projectsLoading: false, projectsError: toApiError(error).message });
        }
      },

      setProject(projectId: string): Promise<void> {
        patchState(store, { projectId, drawings: [], total: 0, page: 1 });
        return load();
      },

      setFilter(changes: { discipline?: Discipline | null; query?: string; page?: number }): Promise<void> {
        patchState(store, {
          discipline: changes.discipline === undefined ? store.discipline() : changes.discipline,
          query: changes.query ?? store.query(),
          page: changes.page ?? 1,
        });
        return load();
      },

      async create(draft: DrawingDraft, file: File): Promise<Drawing | null> {
        const projectId = store.projectId();
        if (!projectId) {
          return null;
        }
        patchState(store, { uploading: true });
        try {
          const uploaded = await uploadDrawingFile(store._uploads, file);
          const created = await firstValueFrom(store._api.createDrawing(projectId, { ...draft, file: uploaded }));
          store._notification.success(`Đã phát hành bản vẽ ${created.code} (Rev ${created.currentRevision.revision}).`);
          return created;
        } catch (error) {
          if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
            store._notification.error(toApiError(error).message);
          }
          return null;
        } finally {
          patchState(store, { uploading: false });
        }
      },
    };
  }),
);
