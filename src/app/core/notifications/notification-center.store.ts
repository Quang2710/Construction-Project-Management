import { DestroyRef, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AppNotification, RealtimeMessage } from '../../shared/models/notification.model';
import { toApiError } from '../../shared/utils/api-error';
import { AuthStore } from '../auth/auth.store';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationService } from './notification.service';
import { NotificationsApiService } from './notifications-api.service';

/** Số thông báo gần nhất hiển thị trong menu chuông. */
export const BELL_SIZE = 15;
/** Khi WebSocket không mở được, hỏi lại server theo chu kỳ (dự phòng). */
export const POLL_INTERVAL_MS = 60_000;

interface NotificationCenterState {
  readonly items: AppNotification[];
  readonly unreadCount: number;
  readonly loading: boolean;
  readonly error: string | null;
}

/** Chuông thông báo: tải danh sách, nhận đẩy real-time, đánh dấu đã đọc. Sống cùng phiên đăng nhập. */
export const NotificationCenterStore = signalStore(
  { providedIn: 'root' },
  withState<NotificationCenterState>({ items: [], unreadCount: 0, loading: false, error: null }),
  withProps(() => ({
    _api: inject(NotificationsApiService),
    _realtime: inject(RealtimeService),
    _auth: inject(AuthStore),
    _toast: inject(NotificationService),
    _router: inject(Router),
  })),
  withMethods((store) => {
    async function refresh(): Promise<void> {
      patchState(store, { loading: store.items().length === 0, error: null });
      try {
        const page = await firstValueFrom(store._api.list({ pageSize: BELL_SIZE }));
        patchState(store, { items: page.data, unreadCount: page.unreadCount, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    }

    async function markRead(item: AppNotification): Promise<void> {
      if (item.read) {
        return;
      }
      // Lạc quan: cập nhật ngay, hoàn tác nếu lỗi.
      const previous = { items: store.items(), unreadCount: store.unreadCount() };
      patchState(store, {
        items: store.items().map((current) => (current.id === item.id ? { ...current, read: true } : current)),
        unreadCount: Math.max(0, store.unreadCount() - 1),
      });
      try {
        await firstValueFrom(store._api.markRead(item.id));
      } catch {
        patchState(store, previous);
      }
    }

    /** Mở đối tượng liên quan (nếu có) và đánh dấu đã đọc. */
    async function open(item: AppNotification): Promise<void> {
      void markRead(item);
      if (item.link) {
        await store._router.navigateByUrl(item.link);
      }
    }

    function receive(message: RealtimeMessage): void {
      if (message.type === 'unread-count') {
        patchState(store, { unreadCount: message.data });
        return;
      }
      const item = message.data;
      if (store.items().some((current) => current.id === item.id)) {
        return;
      }
      patchState(store, {
        items: [item, ...store.items()].slice(0, BELL_SIZE),
        unreadCount: store.unreadCount() + (item.read ? 0 : 1),
      });
      void store._toast.action(item.title, item.link ? 'Xem' : 'Đóng').then((clicked) => {
        if (clicked && item.link) {
          void open(item);
        }
      });
    }

    return {
      refresh,
      markRead,
      open,
      _receive: receive,

      async markAllRead(): Promise<void> {
        const previous = { items: store.items(), unreadCount: store.unreadCount() };
        patchState(store, { items: store.items().map((item) => ({ ...item, read: true })), unreadCount: 0 });
        try {
          await firstValueFrom(store._api.markAllRead());
        } catch {
          patchState(store, previous);
          store._toast.error('Không đánh dấu được đã đọc. Vui lòng thử lại.');
        }
      },

      _reset(): void {
        patchState(store, { items: [], unreadCount: 0, loading: false, error: null });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const subscription = store._realtime.messages$.subscribe((message) => store._receive(message));
      const poll = setInterval(() => {
        if (store._auth.isAuthenticated() && store._realtime.status() !== 'open') {
          void store.refresh();
        }
      }, POLL_INTERVAL_MS);
      inject(DestroyRef).onDestroy(() => {
        subscription.unsubscribe();
        clearInterval(poll);
      });

      // Kết nối theo phiên: đăng nhập → tải + mở WebSocket; đăng xuất → ngắt và xoá dữ liệu.
      effect(() => {
        const token = store._auth.token();
        const authenticated = store._auth.isAuthenticated();
        untracked(() => {
          if (token && authenticated) {
            void store.refresh();
            store._realtime.connect(token);
          } else {
            store._realtime.disconnect();
            store._reset();
          }
        });
      });
    },
  }),
);
