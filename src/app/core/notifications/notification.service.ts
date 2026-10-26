import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/** Kênh toast có nút hành động (xem ToastHostComponent). */
export const ACTION_TOAST_KEY = 'action';

export interface ActionToastData {
  readonly id: string;
  readonly actionLabel: string;
}

/** Thông báo ngắn (toast PrimeNG) ở góc dưới màn hình. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messages = inject(MessageService);
  private readonly pending = new Map<string, (clicked: boolean) => void>();
  private counter = 0;

  success(message: string): void {
    this.messages.add({ severity: 'success', summary: message, life: 3000 });
  }

  error(message: string): void {
    this.messages.add({ severity: 'error', summary: message, life: 5000 });
  }

  info(message: string): void {
    this.messages.add({ severity: 'info', summary: message, life: 3000 });
  }

  /** Thông báo kèm nút hành động; trả về true nếu người dùng bấm nút. duration 0 = giữ tới khi người dùng chọn. */
  action(message: string, actionLabel: string, duration = 6000): Promise<boolean> {
    const id = `toast-${++this.counter}`;
    const data: ActionToastData = { id, actionLabel };
    return new Promise<boolean>((resolve) => {
      this.pending.set(id, resolve);
      this.messages.add({
        key: ACTION_TOAST_KEY,
        severity: 'contrast',
        summary: message,
        data,
        life: duration || undefined,
        sticky: duration === 0,
      });
    });
  }

  /** Gọi từ ToastHostComponent khi toast hành động được bấm hoặc tự đóng. */
  resolveAction(id: string, clicked: boolean): void {
    this.pending.get(id)?.(clicked);
    this.pending.delete(id);
    if (clicked) {
      this.messages.clear(ACTION_TOAST_KEY);
    }
  }
}
