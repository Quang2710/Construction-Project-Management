import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PhotoUploadService } from '../../../shared/data-access/photo-upload.service';
import { UserSummary } from '../../../shared/models/user.model';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { PunchItem, PunchTransition } from '../models/quality.model';
import { QualityApiService } from './quality-api.service';

interface PunchDetailState {
  readonly item: PunchItem | null;
  readonly members: UserSummary[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly busy: boolean;
}

const SUCCESS: Readonly<Record<PunchTransition, string>> = {
  start: 'Đã chuyển sang đang xử lý.',
  resolve: 'Đã báo khắc phục, chờ quản lý xác nhận.',
  verify: 'Đã xác nhận đóng lỗi.',
  reopen: 'Đã mở lại lỗi và báo người xử lý.',
};

export const PunchDetailStore = signalStore(
  withState<PunchDetailState>({ item: null, members: [], loading: false, error: null, busy: false }),
  withProps(() => ({
    _api: inject(QualityApiService),
    _projectsApi: inject(ProjectsApiService),
    _photos: inject(PhotoUploadService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => {
    const isVerifier = computed(() => store._auth.hasAnyRole(PERMISSIONS.verifyPunch));
    const isAssignee = computed(() => !!store.item()?.assignee && store.item()?.assignee?.id === store._auth.user()?.id);
    const canWork = computed(() => store._auth.hasAnyRole(PERMISSIONS.editQuality) && (isAssignee() || isVerifier()));
    const status = computed(() => store.item()?.status ?? null);
    return {
      isAssignee,
      canStart: computed(() => canWork() && status() === 'OPEN'),
      canResolve: computed(() => canWork() && (status() === 'OPEN' || status() === 'IN_PROGRESS')),
      /** Người khắc phục không tự xác nhận đóng. */
      canVerify: computed(() => isVerifier() && status() === 'RESOLVED' && !isAssignee()),
      canReopen: computed(() => isVerifier() && status() === 'RESOLVED'),
      canReassign: computed(() => isVerifier() && status() !== null && status() !== 'VERIFIED'),
    };
  }),
  withMethods((store) => {
    async function run(request: () => Promise<PunchItem>, success: string): Promise<boolean> {
      patchState(store, { busy: true });
      try {
        patchState(store, { item: await request() });
        store._notification.success(success);
        return true;
      } catch (error) {
        if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
          store._notification.error(toApiError(error).message);
        }
        return false;
      } finally {
        patchState(store, { busy: false });
      }
    }

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const item = await firstValueFrom(store._api.punchItem(id));
          patchState(store, { item, loading: false });
          firstValueFrom(store._projectsApi.members(item.projectId))
            .then((members) => patchState(store, { members }))
            .catch(() => undefined);
        } catch (error) {
          patchState(store, { loading: false, error: toApiError(error).message });
        }
      },

      transition(transition: Exclude<PunchTransition, 'resolve'>, note = ''): Promise<boolean> {
        const item = store.item();
        return item
          ? run(() => firstValueFrom(store._api.transitionPunchItem(item.id, transition, { note })), SUCCESS[transition])
          : Promise.resolve(false);
      },

      /** Tải ảnh sau khắc phục rồi báo đã xử lý. */
      resolve(note: string, files: readonly File[]): Promise<boolean> {
        const item = store.item();
        if (!item) {
          return Promise.resolve(false);
        }
        return run(async () => {
          const afterPhotos = await store._photos.uploadAll(files, `Sau khắc phục: ${item.title}`);
          return firstValueFrom(store._api.transitionPunchItem(item.id, 'resolve', { note, afterPhotos }));
        }, SUCCESS.resolve);
      },

      reassign(assigneeId: string, dueDate: string): Promise<boolean> {
        const item = store.item();
        return item
          ? run(() => firstValueFrom(store._api.reassignPunchItem(item.id, { assigneeId, dueDate })), 'Đã cập nhật người xử lý và hạn.')
          : Promise.resolve(false);
      },
    };
  }),
);
