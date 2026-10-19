import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { toApiError } from '../../../shared/utils/api-error';
import { EDITABLE_DIARY_STATUSES, SiteDiary } from '../models/site-diary.model';
import { SiteDiariesApiService } from './site-diaries-api.service';

export type DiaryActionKind = 'submit' | 'approve' | 'reject' | 'delete';

interface DiaryDetailState {
  readonly diary: SiteDiary | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** Thao tác đang chạy (để khoá nút). */
  readonly acting: DiaryActionKind | null;
}

export const DiaryDetailStore = signalStore(
  withState<DiaryDetailState>({ diary: null, loading: false, error: null, acting: null }),
  withProps(() => ({ _api: inject(SiteDiariesApiService), _auth: inject(AuthStore) })),
  withComputed(({ diary, _auth }) => {
    const editable = computed(() => {
      const current = diary();
      return current !== null && EDITABLE_DIARY_STATUSES.includes(current.status);
    });
    return {
      canEdit: computed(() => editable() && _auth.hasAnyRole(PERMISSIONS.editDiaries)),
      canSubmit: computed(() => editable() && _auth.hasAnyRole(PERMISSIONS.editDiaries)),
      canReview: computed(() => diary()?.status === 'SUBMITTED' && _auth.hasAnyRole(PERMISSIONS.approveDiaries)),
      canDelete: computed(() => diary()?.status === 'DRAFT' && _auth.hasAnyRole(PERMISSIONS.editDiaries)),
    };
  }),
  withMethods((store) => {
    async function run(kind: DiaryActionKind, request: Observable<SiteDiary>): Promise<boolean> {
      patchState(store, { acting: kind });
      try {
        patchState(store, { diary: await firstValueFrom(request) });
        return true;
      } catch {
        return false;
      } finally {
        patchState(store, { acting: null });
      }
    }

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          patchState(store, { diary: await firstValueFrom(store._api.get(id)), loading: false });
        } catch (error) {
          patchState(store, { diary: null, loading: false, error: toApiError(error).message });
        }
      },
      submit(): Promise<boolean> {
        const id = store.diary()?.id;
        return id ? run('submit', store._api.submit(id)) : Promise.resolve(false);
      },
      approve(note: string): Promise<boolean> {
        const id = store.diary()?.id;
        return id ? run('approve', store._api.approve(id, note)) : Promise.resolve(false);
      },
      reject(note: string): Promise<boolean> {
        const id = store.diary()?.id;
        return id ? run('reject', store._api.reject(id, note)) : Promise.resolve(false);
      },
      async remove(): Promise<boolean> {
        const id = store.diary()?.id;
        if (!id) {
          return false;
        }
        patchState(store, { acting: 'delete' });
        try {
          await firstValueFrom(store._api.remove(id));
          return true;
        } catch {
          return false;
        } finally {
          patchState(store, { acting: null });
        }
      },
    };
  }),
);
