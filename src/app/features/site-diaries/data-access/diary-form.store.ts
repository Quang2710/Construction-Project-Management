import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { UploadsApiService } from '../../../shared/data-access/uploads-api.service';
import { toApiError } from '../../../shared/utils/api-error';
import { getCurrentPosition } from '../../../shared/utils/geo.utils';
import { compressImage } from '../../../shared/utils/image.utils';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Project } from '../../projects/models/project.model';
import { DiaryContent, DiaryPhoto, GeoPoint, SiteDiary } from '../models/site-diary.model';
import { SiteDiariesApiService } from './site-diaries-api.service';

export const MAX_PHOTOS = 30;

export type PhotoDraftStatus = 'uploading' | 'done' | 'error';

/** Ảnh trong form: có thể đang tải lên (preview bằng object URL) hoặc đã có trên server. */
export interface PhotoDraft {
  readonly localId: string;
  readonly previewUrl: string;
  readonly status: PhotoDraftStatus;
  readonly fileName: string;
  readonly caption: string;
  readonly takenAt: string;
  readonly location: GeoPoint | null;
  readonly photo: DiaryPhoto | null;
  readonly error: string | null;
  /** Giữ file gốc để thử tải lại khi lỗi. */
  readonly file: File | null;
}

export type DiarySaveResult =
  | { readonly ok: true; readonly diary: SiteDiary }
  | { readonly ok: false; readonly code: string; readonly message: string };

interface DiaryFormState {
  readonly diary: SiteDiary | null;
  readonly projects: Project[];
  readonly photos: PhotoDraft[];
  readonly loading: boolean;
  readonly saving: boolean;
  readonly locating: boolean;
  /** Lý do không lấy được GPS ở lần chọn ảnh gần nhất. */
  readonly gpsWarning: string | null;
  readonly error: string | null;
}

let localCounter = 0;

function nextLocalId(): string {
  localCounter += 1;
  return `local-${Date.now().toString(36)}-${localCounter}`;
}

function fromServerPhoto(photo: DiaryPhoto): PhotoDraft {
  return {
    localId: photo.id,
    previewUrl: photo.url,
    status: 'done',
    fileName: photo.fileName,
    caption: photo.caption,
    takenAt: photo.takenAt,
    location: photo.location,
    photo,
    error: null,
    file: null,
  };
}

export const DiaryFormStore = signalStore(
  withState<DiaryFormState>({
    diary: null,
    projects: [],
    photos: [],
    loading: false,
    saving: false,
    locating: false,
    gpsWarning: null,
    error: null,
  }),
  withProps(() => ({
    _diariesApi: inject(SiteDiariesApiService),
    _projectsApi: inject(ProjectsApiService),
    _uploadsApi: inject(UploadsApiService),
  })),
  withComputed(({ photos, diary }) => ({
    isEdit: computed(() => diary() !== null),
    uploading: computed(() => photos().some((photo) => photo.status === 'uploading')),
    failedUploads: computed(() => photos().filter((photo) => photo.status === 'error').length),
    canAddPhotos: computed(() => photos().length < MAX_PHOTOS),
  })),
  withMethods((store) => {
    function updatePhoto(localId: string, changes: Partial<PhotoDraft>): void {
      patchState(store, {
        photos: store.photos().map((photo) => (photo.localId === localId ? { ...photo, ...changes } : photo)),
      });
    }

    function revoke(photo: PhotoDraft): void {
      if (photo.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    }

    async function upload(draft: PhotoDraft): Promise<void> {
      if (!draft.file) {
        return;
      }
      updatePhoto(draft.localId, { status: 'uploading', error: null });
      try {
        const compressed = await compressImage(draft.file);
        const fileName = draft.file.name.replace(/\.[^.]+$/, '') + '.jpg';
        const uploaded = await firstValueFrom(store._uploadsApi.upload(compressed, fileName));
        const current = store.photos().find((photo) => photo.localId === draft.localId);
        if (!current) {
          return; // Người dùng đã xoá ảnh trong lúc tải.
        }
        updatePhoto(draft.localId, {
          status: 'done',
          photo: {
            id: uploaded.id,
            url: uploaded.url,
            fileName: uploaded.fileName,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
            caption: current.caption,
            takenAt: current.takenAt,
            location: current.location,
          },
        });
      } catch (error) {
        updatePhoto(draft.localId, { status: 'error', error: toApiError(error).message });
      }
    }

    return {
      async init(diaryId: string | null): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [projects, diary] = await Promise.all([
            firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' })),
            diaryId ? firstValueFrom(store._diariesApi.get(diaryId)) : Promise.resolve(null),
          ]);
          patchState(store, {
            projects: projects.data.filter((project) => project.status !== 'CANCELLED'),
            diary,
            photos: diary ? diary.photos.map(fromServerPhoto) : [],
            loading: false,
          });
        } catch (error) {
          patchState(store, { loading: false, error: toApiError(error).message });
        }
      },

      /** Thêm ảnh: lấy GPS một lần cho cả lượt chọn, rồi nén + tải từng ảnh song song. */
      async addFiles(files: readonly File[]): Promise<void> {
        const room = MAX_PHOTOS - store.photos().length;
        const accepted = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, room));
        if (accepted.length === 0) {
          return;
        }
        patchState(store, { locating: true, gpsWarning: null });
        const drafts: PhotoDraft[] = accepted.map((file) => ({
          localId: nextLocalId(),
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          fileName: file.name,
          caption: '',
          takenAt: new Date(file.lastModified || Date.now()).toISOString(),
          location: null,
          photo: null,
          error: null,
          file,
        }));
        patchState(store, { photos: [...store.photos(), ...drafts] });

        const geo = await getCurrentPosition();
        const location = geo.ok ? geo.position : null;
        patchState(store, { locating: false, gpsWarning: geo.ok ? null : geo.reason });
        for (const draft of drafts) {
          updatePhoto(draft.localId, { location });
        }
        await Promise.all(drafts.map((draft) => upload({ ...draft, location })));
      },

      retryUpload(localId: string): Promise<void> {
        const draft = store.photos().find((photo) => photo.localId === localId);
        return draft ? upload(draft) : Promise.resolve();
      },

      removePhoto(localId: string): void {
        const draft = store.photos().find((photo) => photo.localId === localId);
        if (draft) {
          revoke(draft);
        }
        patchState(store, { photos: store.photos().filter((photo) => photo.localId !== localId) });
      },

      setCaption(localId: string, caption: string): void {
        const draft = store.photos().find((photo) => photo.localId === localId);
        updatePhoto(localId, { caption, photo: draft?.photo ? { ...draft.photo, caption } : null });
      },

      /** Ảnh đã tải xong, kèm chú thích mới nhất. */
      uploadedPhotos(): DiaryPhoto[] {
        return store
          .photos()
          .flatMap((draft) => (draft.status === 'done' && draft.photo ? [{ ...draft.photo, caption: draft.caption.trim() }] : []));
      },

      async save(projectId: string, date: string, content: DiaryContent, submit: boolean): Promise<DiarySaveResult> {
        const current = store.diary();
        patchState(store, { saving: true, error: null });
        try {
          let diary = current
            ? await firstValueFrom(store._diariesApi.update(current.id, content))
            : await firstValueFrom(store._diariesApi.create({ ...content, projectId, date }));
          patchState(store, { diary });
          if (submit) {
            diary = await firstValueFrom(store._diariesApi.submit(diary.id));
            patchState(store, { diary });
          }
          return { ok: true, diary };
        } catch (error) {
          const apiError = toApiError(error);
          patchState(store, { error: apiError.message });
          return { ok: false, code: apiError.code, message: apiError.message };
        } finally {
          patchState(store, { saving: false });
        }
      },

      _revokeAll(): void {
        store.photos().forEach(revoke);
      },
    };
  }),
  withHooks({
    onDestroy(store) {
      store._revokeAll();
    },
  }),
);
