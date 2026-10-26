import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';

/** Trạng thái mạng của thiết bị + việc app đang hiển thị dữ liệu lấy từ cache offline. */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly view = inject(DOCUMENT).defaultView;

  readonly online = signal(this.view?.navigator.onLine ?? true);
  /** Thời điểm (ISO) của dữ liệu cache cũ nhất vừa được dùng thay cho server; null = đang dùng dữ liệu mới. */
  readonly cachedDataAt = signal<string | null>(null);
  readonly offline = computed(() => !this.online());

  constructor() {
    const update = (): void => {
      this.online.set(this.view?.navigator.onLine ?? true);
      if (this.online()) {
        this.cachedDataAt.set(null);
      }
    };
    this.view?.addEventListener('online', update);
    this.view?.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      this.view?.removeEventListener('online', update);
      this.view?.removeEventListener('offline', update);
    });
  }

  markServedFromCache(cachedAt: string): void {
    const current = this.cachedDataAt();
    if (!current || cachedAt < current) {
      this.cachedDataAt.set(cachedAt);
    }
  }

  markFresh(): void {
    this.cachedDataAt.set(null);
  }
}
