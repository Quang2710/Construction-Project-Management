import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DIARY_STATUS_LABELS, DiaryStatus } from '../../models/site-diary.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

const STATUS_ICONS: Readonly<Record<DiaryStatus, string>> = {
  DRAFT: 'edit_note',
  SUBMITTED: 'hourglass_top',
  APPROVED: 'verified',
  REJECTED: 'undo',
};

/** Trạng thái luôn có icon + chữ, không chỉ dựa vào màu. */
@Component({
  selector: 'app-diary-status-chip',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + status().toLowerCase()' },
  template: `<app-icon>{{ icon() }}</app-icon><span>{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 999px;
      font: var(--app-label-medium);
      white-space: nowrap;
    }
    app-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.chip--draft) {
      background: var(--app-surface-container-highest);
      color: var(--app-on-surface-variant);
    }
    :host(.chip--submitted) {
      background: var(--app-tertiary-container);
      color: var(--app-on-tertiary-container);
    }
    :host(.chip--approved) {
      background: var(--app-success-container);
      color: var(--app-on-success-container);
    }
    :host(.chip--rejected) {
      background: var(--app-error-container);
      color: var(--app-on-error-container);
    }
  `,
})
export class DiaryStatusChipComponent {
  readonly status = input.required<DiaryStatus>();
  protected readonly label = computed(() => DIARY_STATUS_LABELS[this.status()]);
  protected readonly icon = computed(() => STATUS_ICONS[this.status()]);
}
