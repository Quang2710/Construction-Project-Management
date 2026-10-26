import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { UploadsApiService } from '../../../shared/data-access/uploads-api.service';
import { toApiError } from '../../../shared/utils/api-error';
import { Drawing, DrawingRevision } from '../models/document.model';
import { DocumentsApiService } from './documents-api.service';
import { uploadDrawingFile } from './documents.store';

interface DrawingDetailState {
  readonly drawing: Drawing | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** Phiên bản đang xem (mặc định: mới nhất). */
  readonly revisionId: string | null;
  /** Phiên bản đem so sánh với revisionId; null = không so sánh. */
  readonly compareId: string | null;
  /** Bộ nhớ đệm nội dung PDF theo revision id. */
  readonly files: Readonly<Record<string, ArrayBuffer>>;
  readonly fileLoading: boolean;
  readonly fileError: string | null;
  readonly uploading: boolean;
}

export const DrawingDetailStore = signalStore(
  withState<DrawingDetailState>({
    drawing: null,
    loading: false,
    error: null,
    revisionId: null,
    compareId: null,
    files: {},
    fileLoading: false,
    fileError: null,
    uploading: false,
  }),
  withProps(() => ({
    _api: inject(DocumentsApiService),
    _uploads: inject(UploadsApiService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => {
    const find = (id: string | null): DrawingRevision | null => store.drawing()?.revisions.find((revision) => revision.id === id) ?? null;
    const revision = computed(() => find(store.revisionId()));
    const compareRevision = computed(() => find(store.compareId()));
    return {
      canManage: computed(() => store._auth.hasAnyRole(PERMISSIONS.manageDocuments)),
      revision,
      compareRevision,
      isLatest: computed(() => !!revision() && revision()?.id === store.drawing()?.currentRevision.id),
      /** Mới nhất trước, như bảng lịch sử phát hành. */
      revisionsDesc: computed(() => [...(store.drawing()?.revisions ?? [])].reverse()),
      viewData: computed(() => {
        const id = revision()?.id;
        return id ? (store.files()[id] ?? null) : null;
      }),
      /** Cặp [cũ, mới] theo thứ tự phát hành, bất kể chọn bên nào trước. */
      comparePair: computed(() => {
        const a = revision();
        const b = compareRevision();
        const drawing = store.drawing();
        if (!a || !b || !drawing) {
          return null;
        }
        const order = (item: DrawingRevision): number => drawing.revisions.findIndex((rev) => rev.id === item.id);
        const [older, newer] = order(a) < order(b) ? [a, b] : [b, a];
        const olderData = store.files()[older.id];
        const newerData = store.files()[newer.id];
        return olderData && newerData ? { older, newer, olderData, newerData } : null;
      }),
    };
  }),
  withMethods((store) => {
    async function ensureFile(revision: DrawingRevision | null): Promise<void> {
      if (!revision || store.files()[revision.id]) {
        return;
      }
      patchState(store, { fileLoading: true, fileError: null });
      try {
        const data = await firstValueFrom(store._api.fileBytes(revision.file.url));
        patchState(store, { files: { ...store.files(), [revision.id]: data }, fileLoading: false });
      } catch (error) {
        patchState(store, { fileLoading: false, fileError: toApiError(error).message });
      }
    }

    function revisionByLabel(label: string | null): DrawingRevision | null {
      return label ? (store.drawing()?.revisions.find((revision) => revision.revision === label) ?? null) : null;
    }

    return {
      /** rev/compare: ký hiệu phiên bản từ query string (?rev=B&compare=A). */
      async load(id: string, rev: string | null, compare: string | null): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const drawing = await firstValueFrom(store._api.drawing(id));
          patchState(store, { drawing, loading: false });
          const current = revisionByLabel(rev) ?? drawing.currentRevision;
          const other = revisionByLabel(compare);
          patchState(store, { revisionId: current.id, compareId: other && other.id !== current.id ? other.id : null });
          await Promise.all([ensureFile(current), ensureFile(other)]);
        } catch (error) {
          patchState(store, { loading: false, error: toApiError(error).message });
        }
      },

      async selectRevision(revisionId: string): Promise<void> {
        patchState(store, { revisionId, compareId: store.compareId() === revisionId ? null : store.compareId() });
        await ensureFile(store.revision());
      },

      /** Bật so sánh: mặc định so với phiên bản liền trước. */
      async startCompare(compareId?: string): Promise<void> {
        const drawing = store.drawing();
        const current = store.revision();
        if (!drawing || !current || drawing.revisions.length < 2) {
          return;
        }
        const index = drawing.revisions.findIndex((revision) => revision.id === current.id);
        const fallback = drawing.revisions[index > 0 ? index - 1 : index + 1];
        const target = compareId && compareId !== current.id ? compareId : fallback.id;
        patchState(store, { compareId: target });
        await ensureFile(store.compareRevision());
      },

      stopCompare(): void {
        patchState(store, { compareId: null });
      },

      retryFile(): Promise<void> {
        return Promise.all([ensureFile(store.revision()), ensureFile(store.compareRevision())]).then(() => undefined);
      },

      async addRevision(description: string, file: File): Promise<boolean> {
        const drawing = store.drawing();
        if (!drawing) {
          return false;
        }
        patchState(store, { uploading: true });
        try {
          const uploaded = await uploadDrawingFile(store._uploads, file);
          const updated = await firstValueFrom(store._api.addRevision(drawing.id, { description, file: uploaded }));
          const latest = updated.currentRevision;
          patchState(store, { drawing: updated, revisionId: latest.id, compareId: null });
          store._notification.success(`Đã phát hành phiên bản ${latest.revision}.`);
          await ensureFile(latest);
          return true;
        } catch (error) {
          if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
            store._notification.error(toApiError(error).message);
          }
          return false;
        } finally {
          patchState(store, { uploading: false });
        }
      },
    };
  }),
);
