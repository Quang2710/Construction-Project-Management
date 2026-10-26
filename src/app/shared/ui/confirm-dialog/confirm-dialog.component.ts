import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogCloseDirective, injectDialogData } from '../dialog/app-dialog.service';
import { IconComponent } from '../icon/icon.component';

export interface ConfirmDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  /** Hiển thị nút xác nhận màu cảnh báo cho thao tác nguy hiểm. */
  readonly destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [ButtonModule, DialogCloseDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="body">
      <span class="icon" [class.icon--danger]="data.destructive" aria-hidden="true">
        <app-icon>{{ data.destructive ? 'warning' : 'help' }}</app-icon>
      </span>
      <div>
        <h2 class="title">{{ data.title }}</h2>
        <p class="message">{{ data.message }}</p>
      </div>
    </div>
    <div dialogActions>
      <button pButton text severity="secondary" type="button" [appDialogClose]="false">{{ data.cancelText ?? 'Huỷ' }}</button>
      <button pButton type="button" [severity]="data.destructive ? 'danger' : undefined" [appDialogClose]="true">
        {{ data.confirmText ?? 'Xác nhận' }}
      </button>
    </div>
  `,
  styles: `
    .body {
      display: flex;
      gap: 16px;
      padding: 24px 24px 4px;
    }
    .icon {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--app-primary-container);
      color: var(--app-on-primary-container);
    }
    .icon--danger {
      background: var(--app-error-container);
      color: var(--app-error);
    }
    .title {
      margin: 0;
      font: var(--app-title-medium);
    }
    .message {
      margin: 6px 0 0;
      color: var(--app-on-surface-variant);
      line-height: 1.5;
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = injectDialogData<ConfirmDialogData>();
}
