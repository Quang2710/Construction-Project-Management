import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastMessageOptions } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ToastCloseEvent } from 'primeng/types/toast';
import { ACTION_TOAST_KEY, ActionToastData, NotificationService } from './notification.service';

function actionData(message: ToastMessageOptions): ActionToastData | null {
  const data: unknown = message.data;
  return typeof data === 'object' && data !== null && 'id' in data ? (data as ActionToastData) : null;
}

/** Nơi hiển thị toast của NotificationService (đặt một lần ở AppComponent). */
@Component({
  selector: 'app-toast-host',
  imports: [
    ButtonModule,
    ToastModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast position="bottom-center" [breakpoints]="breakpoints" />
    <p-toast [key]="actionKey" position="bottom-center" [breakpoints]="breakpoints" (onClose)="onClose($event)">
      <ng-template #message let-message>
        <div class="action">
          <span class="action__text">{{ message.summary }}</span>
          @if (data(message); as data) {
            <button pButton type="button" text size="small" class="action__button" (click)="click(data.id)">
              {{ data.actionLabel }}
            </button>
          }
        </div>
      </ng-template>
    </p-toast>
  `,
  styles: `
    .action {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 12px;
    }
    .action__text {
      flex: 1;
      font-weight: 500;
    }
    .action__button {
      flex: none;
      color: inherit;
      font-weight: 600;
    }
  `,
})
export class ToastHostComponent {
  private readonly notifications = inject(NotificationService);
  protected readonly actionKey = ACTION_TOAST_KEY;
  protected readonly breakpoints = { '600px': { width: 'calc(100vw - 32px)', left: '16px', right: '16px', transform: 'none' } };

  protected data(message: ToastMessageOptions): ActionToastData | null {
    return actionData(message);
  }

  protected click(id: string): void {
    this.notifications.resolveAction(id, true);
  }

  /** Tự hết giờ / bấm X: coi như không chọn hành động. */
  protected onClose(event: ToastCloseEvent): void {
    const data = actionData(event.message);
    if (data) {
      this.notifications.resolveAction(data.id, false);
    }
  }
}
