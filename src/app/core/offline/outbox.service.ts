import { computed, DestroyRef, DOCUMENT, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { createKeyValueStore } from '../../shared/utils/idb-store';
import { AuthStore } from '../auth/auth.store';
import { NotificationService } from '../notifications/notification.service';
import { NetworkStatusService } from './network-status.service';

export type OutboxStatus = 'pending' | 'failed';

/** Một thao tác ghi làm khi mất mạng, chờ gửi lên server. Payload phải lưu được vào IndexedDB (có thể chứa Blob). */
export interface OutboxEntry<T = unknown> {
  readonly id: string;
  readonly kind: string;
  /** Mô tả cho người dùng, ví dụ "Nhật ký GTHM · 26/10/2026". */
  readonly label: string;
  readonly userId: string;
  readonly payload: T;
  readonly createdAt: string;
  readonly attempts: number;
  readonly status: OutboxStatus;
  readonly error: string | null;
}

export type OutboxOutcome =
  | { readonly kind: 'done'; readonly message: string; readonly link?: string }
  /** Vẫn chưa có mạng: giữ nguyên, thử lại sau. */
  | { readonly kind: 'offline' }
  /** Server từ chối (409, 422...): cần người dùng xem lại, không tự thử lại. */
  | { readonly kind: 'failed'; readonly message: string };

export interface OutboxContext<T> {
  /** Lưu tiến độ dở dang (vd. ảnh đã tải, id nhật ký đã tạo) để lần thử sau không làm lại. */
  saveProgress(payload: T): Promise<void>;
}

export type OutboxProcessor<T> = (payload: T, context: OutboxContext<T>) => Promise<OutboxOutcome>;

/** Tải lười processor (code feature không nằm trong bundle khởi động). */
export type OutboxProcessorLoader<T> = () => Promise<OutboxProcessor<T>>;

/** Khi còn mục chờ, thử đồng bộ lại theo chu kỳ (phòng khi sự kiện "online" không bắn). */
const RETRY_INTERVAL_MS = 30_000;

/**
 * Hàng đợi offline dùng chung: lưu IndexedDB, tự đồng bộ khi có mạng / khi đăng nhập / theo chu kỳ.
 * Feature đăng ký processor theo `kind` (ví dụ nhật ký công trường: 'diary-save').
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly auth = inject(AuthStore);
  private readonly network = inject(NetworkStatusService);
  private readonly toast = inject(NotificationService);
  private readonly storage = createKeyValueStore<OutboxEntry>('outbox');
  private readonly processors = new Map<string, OutboxProcessor<never>>();
  private readonly loaders = new Map<string, OutboxProcessorLoader<never>>();

  /** Các mục của người dùng hiện tại, cũ nhất trước. */
  readonly entries = signal<readonly OutboxEntry[]>([]);
  readonly syncing = signal(false);
  readonly pendingCount = computed(() => this.entries().filter((entry) => entry.status === 'pending').length);
  readonly failedCount = computed(() => this.entries().filter((entry) => entry.status === 'failed').length);

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    const onOnline = (): void => void this.sync();
    view?.addEventListener('online', onOnline);
    const timer = setInterval(() => {
      if (this.pendingCount() > 0) {
        void this.sync();
      }
    }, RETRY_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('online', onOnline);
      clearInterval(timer);
    });

    // Đổi người dùng: chỉ hiện và đồng bộ mục của chính họ (mục người khác vẫn giữ trong IndexedDB).
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => void this.reload(userId).then(() => this.sync()));
    });
  }

  register<T>(kind: string, processor: OutboxProcessor<T>): void {
    this.processors.set(kind, processor as OutboxProcessor<never>);
  }

  /** Đăng ký processor tải lười: chỉ nạp code feature khi thực sự có mục cần đồng bộ. */
  registerLoader<T>(kind: string, loader: OutboxProcessorLoader<T>): void {
    this.loaders.set(kind, loader as OutboxProcessorLoader<never>);
  }

  private async processorFor(kind: string): Promise<OutboxProcessor<never> | undefined> {
    const loaded = this.processors.get(kind);
    if (loaded) {
      return loaded;
    }
    const loader = this.loaders.get(kind);
    if (!loader) {
      return undefined;
    }
    const processor = await loader();
    this.processors.set(kind, processor);
    return processor;
  }

  async enqueue<T>(kind: string, label: string, payload: T): Promise<OutboxEntry<T> | null> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return null;
    }
    const entry: OutboxEntry<T> = {
      id: `obx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      label,
      userId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
      error: null,
    };
    await this.storage.set(entry.id, entry);
    this.entries.update((entries) => [...entries, entry]);
    return entry;
  }

  /** Gửi lần lượt các mục chờ; dừng ngay khi phát hiện vẫn mất mạng. */
  async sync(): Promise<void> {
    if (this.syncing() || this.network.offline() || !this.auth.user()) {
      return;
    }
    this.syncing.set(true);
    try {
      for (const entry of this.entries().filter((item) => item.status === 'pending')) {
        const processor = await this.processorFor(entry.kind).catch(() => undefined);
        if (!processor) {
          continue;
        }
        const outcome = await this.run(processor, entry);
        if (outcome.kind === 'offline') {
          break;
        }
      }
    } finally {
      this.syncing.set(false);
    }
  }

  async retry(id: string): Promise<void> {
    await this.patch(id, { status: 'pending', error: null });
    await this.sync();
  }

  async discard(id: string): Promise<void> {
    await this.storage.delete(id);
    this.entries.update((entries) => entries.filter((entry) => entry.id !== id));
  }

  private async run(processor: OutboxProcessor<never>, entry: OutboxEntry): Promise<OutboxOutcome> {
    let current = entry;
    const context: OutboxContext<unknown> = {
      saveProgress: async (payload) => {
        current = await this.patch(entry.id, { payload });
      },
    };
    let outcome: OutboxOutcome;
    try {
      outcome = await (processor as OutboxProcessor<unknown>)(current.payload, context);
    } catch {
      outcome = { kind: 'failed', message: 'Lỗi không xác định khi đồng bộ.' };
    }
    if (outcome.kind === 'done') {
      await this.discard(entry.id);
      this.toast.success(outcome.message);
    } else if (outcome.kind === 'failed') {
      await this.patch(entry.id, { status: 'failed', error: outcome.message, attempts: current.attempts + 1 });
      this.toast.error(`Không đồng bộ được "${entry.label}": ${outcome.message}`);
    } else {
      await this.patch(entry.id, { attempts: current.attempts + 1 });
    }
    return outcome;
  }

  private async patch(id: string, changes: Partial<Omit<OutboxEntry, 'id'>>): Promise<OutboxEntry> {
    const existing = this.entries().find((entry) => entry.id === id) ?? (await this.storage.get(id));
    if (!existing) {
      throw new Error(`Không tìm thấy mục ${id} trong hàng đợi.`);
    }
    const updated = { ...existing, ...changes };
    await this.storage.set(id, updated);
    this.entries.update((entries) => entries.map((entry) => (entry.id === id ? updated : entry)));
    return updated;
  }

  private async reload(userId: string | null): Promise<void> {
    if (!userId) {
      this.entries.set([]);
      return;
    }
    try {
      const all = await this.storage.entries();
      this.entries.set(
        all
          .map(([, entry]) => entry)
          .filter((entry) => entry.userId === userId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    } catch {
      this.entries.set([]);
    }
  }
}
