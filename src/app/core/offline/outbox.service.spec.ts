import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../auth/auth.store';
import { NotificationService } from '../notifications/notification.service';
import { NetworkStatusService } from './network-status.service';
import { OutboxOutcome, OutboxService } from './outbox.service';

interface Payload {
  readonly step: number;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('OutboxService', () => {
  let outbox: OutboxService;
  const user = signal<{ id: string } | null>({ id: 'u1' });
  const online = signal(true);
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    user.set({ id: 'u1' });
    online.set(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { user } },
        { provide: NetworkStatusService, useValue: { offline: () => !online() } },
        { provide: NotificationService, useValue: toast },
      ],
    });
    outbox = TestBed.inject(OutboxService);
    TestBed.tick();
    await settle();
    for (const entry of outbox.entries()) {
      await outbox.discard(entry.id);
    }
  });

  afterEach(() => vi.clearAllMocks());

  it('mất mạng: chỉ xếp hàng; có mạng: gửi, xoá khỏi hàng đợi, báo thành công', async () => {
    const processor = vi.fn(async (): Promise<OutboxOutcome> => ({ kind: 'done', message: 'Đã đồng bộ' }));
    outbox.register<Payload>('test', processor);
    online.set(false);
    await outbox.enqueue<Payload>('test', 'Mục 1', { step: 0 });
    await outbox.sync();
    expect(processor).not.toHaveBeenCalled();
    expect(outbox.pendingCount()).toBe(1);

    online.set(true);
    await outbox.sync();
    expect(processor).toHaveBeenCalledWith({ step: 0 }, expect.anything());
    expect(outbox.entries()).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith('Đã đồng bộ');
  });

  it('processor báo vẫn offline: giữ mục, dừng các mục sau; lưu tiến độ dở dang', async () => {
    const seen: number[] = [];
    outbox.register<Payload>('test', async (payload, context) => {
      seen.push(payload.step);
      await context.saveProgress({ step: payload.step + 1 });
      return { kind: 'offline' };
    });
    await outbox.enqueue<Payload>('test', 'A', { step: 0 });
    await outbox.enqueue<Payload>('test', 'B', { step: 10 });
    await outbox.sync();

    expect(seen).toEqual([0]);
    expect(outbox.entries().map((entry) => [entry.label, (entry.payload as Payload).step, entry.attempts])).toEqual([
      ['A', 1, 1],
      ['B', 10, 0],
    ]);
  });

  it('server từ chối: đánh dấu lỗi, không tự thử lại; thử lại thủ công / bỏ mục', async () => {
    let outcome: OutboxOutcome = { kind: 'failed', message: 'Dự án đã có nhật ký cho ngày này.' };
    const processor = vi.fn(async () => outcome);
    outbox.register<Payload>('test', processor);
    const entry = await outbox.enqueue<Payload>('test', 'Nhật ký P1', { step: 0 });
    await outbox.sync();
    expect(outbox.failedCount()).toBe(1);
    expect(outbox.entries()[0].error).toBe('Dự án đã có nhật ký cho ngày này.');
    expect(toast.error).toHaveBeenCalled();

    await outbox.sync();
    expect(processor).toHaveBeenCalledTimes(1);

    outcome = { kind: 'done', message: 'OK' };
    await outbox.retry(entry?.id ?? '');
    expect(outbox.entries()).toHaveLength(0);
  });

  it('processor tải lười chỉ nạp khi có mục cần gửi; mỗi người dùng chỉ thấy mục của mình', async () => {
    const loader = vi.fn(async () => async (): Promise<OutboxOutcome> => ({ kind: 'done', message: 'OK' }));
    outbox.registerLoader<Payload>('lazy', loader);
    await outbox.sync();
    expect(loader).not.toHaveBeenCalled();

    online.set(false);
    await outbox.enqueue<Payload>('lazy', 'Của u1', { step: 0 });
    user.set({ id: 'u2' });
    TestBed.tick();
    await settle();
    expect(outbox.entries()).toHaveLength(0);

    user.set({ id: 'u1' });
    TestBed.tick();
    await settle();
    expect(outbox.entries().map((entry) => entry.label)).toEqual(['Của u1']);
    online.set(true);
    await outbox.sync();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(outbox.entries()).toHaveLength(0);
  });
});
