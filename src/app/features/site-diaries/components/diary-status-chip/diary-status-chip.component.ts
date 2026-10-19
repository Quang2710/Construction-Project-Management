import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DIARY_STATUS_LABELS, DiaryStatus } from '../../models/site-diary.model';

const STATUS_ICONS: Readonly<Record<DiaryStatus, string>> = {
  DRAFT: 'edit_note',
  SUBMITTED: 'hourglass_top',
  APPROVED: 'verified',
  REJECTED: 'undo',
};

/** Trạng thái luôn có icon + chữ, không chỉ dựa vào màu. */
@Component({
  selector: 'app-diary-status-chip',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + status().toLowerCase()' },
  template: `<mat-icon>{{ icon() }}</mat-icon><span>{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.chip--draft) {
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    :host(.chip--submitted) {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    :host(.chip--approved) {
      background: var(--app-success-container);
      color: var(--app-on-success-container);
    }
    :host(.chip--rejected) {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class DiaryStatusChipComponent {
  readonly status = input.required<DiaryStatus>();
  protected readonly label = computed(() => DIARY_STATUS_LABELS[this.status()]);
  protected readonly icon = computed(() => STATUS_ICONS[this.status()]);
}
