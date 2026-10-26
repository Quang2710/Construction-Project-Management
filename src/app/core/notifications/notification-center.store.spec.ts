import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AppNotification, RealtimeMessage } from '../../shared/models/notification.model';
import { AuthStore } from '../auth/auth.store';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationCenterStore } from './notification-center.store';
import { NotificationService } from './notification.service';

function notification(id: string, read = false): AppNotification {
  return { id, type: 'PUNCH', title: `TB ${id}`, message: '', link: `/quality/punch/${id}`, projectCode: 'P1', createdAt: '2026-10-26T00:00:00Z', read };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('NotificationCenterStore', () => {
  let http: HttpTestingController;
  const token = signal<string | null>(null);
  const messages = new Subject<RealtimeMessage>();
  const realtime = { messages$: messages.asObservable(), status: signal('idle'), connect: vi.fn(), disconnect: vi.fn() };
  const toast = { action: vi.fn(async () => false), error: vi.fn(), success: vi.fn(), info: vi.fn() };

  function setup(): InstanceType<typeof NotificationCenterStore> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthStore, useValue: { token, isAuthenticated: computed(() => token() !== null) } },
        { provide: RealtimeService, useValue: realtime },
        { provide: NotificationService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(NotificationCenterStore);
  }

  async function login(store: InstanceType<typeof NotificationCenterStore>, items: AppNotification[], unreadCount: number): Promise<void> {
    token.set('jwt-1');
    TestBed.tick();
    http.expectOne((req) => req.url === '/api/v1/notifications').flush({ data: items, total: items.length, page: 1, pageSize: 15, unreadCount });
    await settle();
    expect(store.items()).toHaveLength(items.length);
  }

  afterEach(() => {
    http.verify();
    token.set(null);
    vi.clearAllMocks();
  });

  it('đăng nhập: tải danh sách + mở WebSocket; đăng xuất: ngắt và xoá dữ liệu', async () => {
    const store = setup();
    TestBed.tick();
    expect(realtime.connect).not.toHaveBeenCalled();

    await login(store, [notification('1')], 1);
    expect(realtime.connect).toHaveBeenCalledWith('jwt-1');
    expect(store.unreadCount()).toBe(1);

    token.set(null);
    TestBed.tick();
    expect(realtime.disconnect).toHaveBeenCalled();
    expect(store.items()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });

  it('nhận đẩy real-time: thêm lên đầu, tăng số chưa đọc, hiện toast; bỏ trùng', async () => {
    const store = setup();
    await login(store, [notification('1')], 1);

    messages.next({ type: 'notification', data: notification('2') });
    messages.next({ type: 'notification', data: notification('2') });
    expect(store.items().map((item) => item.id)).toEqual(['2', '1']);
    expect(store.unreadCount()).toBe(2);
    expect(toast.action).toHaveBeenCalledTimes(1);
    expect(toast.action).toHaveBeenCalledWith('TB 2', 'Xem');

    messages.next({ type: 'unread-count', data: 0 });
    expect(store.unreadCount()).toBe(0);
  });

  it('bấm "Xem" trên toast: mở link và đánh dấu đã đọc', async () => {
    const store = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await login(store, [], 0);
    toast.action.mockResolvedValueOnce(true);

    messages.next({ type: 'notification', data: notification('9') });
    await settle();
    expect(navigate).toHaveBeenCalledWith('/quality/punch/9');
    http.expectOne('/api/v1/notifications/9').flush(notification('9', true));
    expect(store.unreadCount()).toBe(0);
  });

  it('đánh dấu đã đọc lạc quan, hoàn tác khi lỗi', async () => {
    const store = setup();
    await login(store, [notification('1'), notification('2')], 2);

    const pending = store.markRead(store.items()[0]);
    expect(store.unreadCount()).toBe(1);
    const request = http.expectOne('/api/v1/notifications/1');
    expect(request.request.body).toEqual({ read: true });
    request.flush({ code: 'X', message: 'lỗi' }, { status: 500, statusText: 'Error' });
    await pending;
    expect(store.unreadCount()).toBe(2);
    expect(store.items()[0].read).toBe(false);

    const all = store.markAllRead();
    expect(store.items().every((item) => item.read)).toBe(true);
    http.expectOne('/api/v1/notifications/read-all').flush(null);
    await all;
    expect(store.unreadCount()).toBe(0);
  });
});
