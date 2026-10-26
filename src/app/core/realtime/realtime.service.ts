import { DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isRealtimeMessage, RealtimeMessage } from '../../shared/models/notification.model';

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'closed';

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
/** Mã đóng do server gửi khi token không hợp lệ: không tự kết nối lại. */
const UNAUTHORIZED_CLOSE_CODE = 4401;
/** Mã client tự đóng khi thiết bị mất mạng. */
const OFFLINE_CLOSE_CODE = 4000;

/**
 * Kết nối WebSocket nhận thông báo real-time. Fake BE: MSW chặn WebSocket ngay trong trang;
 * khi có BE thật chỉ cần BE phục vụ đúng environment.realtimePath.
 * Tự kết nối lại với backoff luỹ thừa, và ngay khi trình duyệt có mạng trở lại.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly document = inject(DOCUMENT);

  private readonly messagesSubject = new Subject<RealtimeMessage>();
  readonly messages$: Observable<RealtimeMessage> = this.messagesSubject.asObservable();
  readonly status = signal<RealtimeStatus>('idle');

  private socket: WebSocket | null = null;
  private token: string | null = null;
  private retryMs = MIN_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onOnline = (): void => {
    if (this.token && this.status() !== 'open') {
      this.retryMs = MIN_RETRY_MS;
      this.open();
    }
  };
  /** Mất mạng: đóng chủ động (kết nối giả lập của MSW không tự rớt), chờ sự kiện "online". */
  private readonly onOffline = (): void => {
    this.clearRetry();
    const socket = this.socket;
    this.socket = null;
    // Client chỉ được dùng mã 1000 hoặc 3000–4999.
    socket?.close(OFFLINE_CLOSE_CODE, 'offline');
    if (this.token) {
      this.status.set('closed');
    }
  };

  constructor() {
    this.document.defaultView?.addEventListener('online', this.onOnline);
    this.document.defaultView?.addEventListener('offline', this.onOffline);
    inject(DestroyRef).onDestroy(() => {
      this.disconnect();
      this.document.defaultView?.removeEventListener('online', this.onOnline);
      this.document.defaultView?.removeEventListener('offline', this.onOffline);
    });
  }

  connect(token: string): void {
    if (this.token === token && this.socket) {
      return;
    }
    this.disconnect();
    this.token = token;
    this.retryMs = MIN_RETRY_MS;
    this.open();
  }

  disconnect(): void {
    this.token = null;
    this.clearRetry();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'logout');
    this.status.set('idle');
  }

  private open(): void {
    const view = this.document.defaultView;
    if (!this.token || !view || typeof WebSocket === 'undefined') {
      return;
    }
    this.clearRetry();
    if (!view.navigator.onLine) {
      this.status.set('closed');
      return;
    }
    const protocol = view.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${view.location.host}${environment.realtimePath}?token=${encodeURIComponent(this.token)}`;
    this.status.set('connecting');
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.retryMs = MIN_RETRY_MS;
      this.status.set('open');
    });
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') {
        return;
      }
      try {
        const message: unknown = JSON.parse(event.data);
        if (isRealtimeMessage(message)) {
          this.messagesSubject.next(message);
        }
      } catch {
        // Bỏ qua thông điệp không phải JSON.
      }
    });
    socket.addEventListener('close', (event: CloseEvent) => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.status.set('closed');
      if (event.code !== UNAUTHORIZED_CLOSE_CODE) {
        this.scheduleRetry();
      }
    });
  }

  private scheduleRetry(): void {
    if (!this.token || !this.document.defaultView?.navigator.onLine) {
      return;
    }
    // Thêm nhiễu ngẫu nhiên để nhiều tab/thiết bị không kết nối lại cùng lúc.
    const delay = this.retryMs + Math.random() * 500;
    this.retryMs = Math.min(MAX_RETRY_MS, this.retryMs * 2);
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
