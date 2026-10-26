import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { NotificationCenterStore } from '../../../core/notifications/notification-center.store';
import { NotificationsApiService } from '../../../core/notifications/notifications-api.service';
import { AppNotification } from '../../../shared/models/notification.model';
import { toApiError } from '../../../shared/utils/api-error';

const PAGE_SIZE = 20;

interface NotificationsListState {
  readonly items: AppNotification[];
  readonly total: number;
  readonly page: number;
  readonly unreadOnly: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

/** Trang "Tất cả thông báo": phân trang, lọc chưa đọc; đồng bộ với chuông qua NotificationCenterStore. */
export const NotificationsListStore = signalStore(
  withState<NotificationsListState>({ items: [], total: 0, page: 1, unreadOnly: false, loading: false, error: null }),
  withProps(() => ({
    _api: inject(NotificationsApiService),
    _center: inject(NotificationCenterStore),
    pageSize: PAGE_SIZE,
  })),
  withMethods((store) => {
    async function load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(
          store._api.list({ unreadOnly: store.unreadOnly() || null, page: store.page(), pageSize: PAGE_SIZE }),
        );
        patchState(store, { items: page.data, total: page.total, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    }

    return {
      load,

      setFilter(changes: { unreadOnly?: boolean; page?: number }): Promise<void> {
        patchState(store, { unreadOnly: changes.unreadOnly ?? store.unreadOnly(), page: changes.page ?? 1 });
        return load();
      },

      async open(item: AppNotification): Promise<void> {
        patchState(store, { items: store.items().map((current) => (current.id === item.id ? { ...current, read: true } : current)) });
        await store._center.open(item);
      },

      async markAllRead(): Promise<void> {
        await store._center.markAllRead();
        await load();
      },
    };
  }),
);
