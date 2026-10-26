import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PUNCH_SEVERITY_LABELS, PunchSeverity } from '../../models/quality.model';

const ICONS: Readonly<Record<PunchSeverity, string>> = {
  LOW: 'keyboard_arrow_down',
  MEDIUM: 'drag_handle',
  HIGH: 'keyboard_double_arrow_up',
};

/** Mức độ lỗi: luôn kèm icon + chữ, không chỉ dựa vào màu. */
@Component({
  selector: 'app-severity-badge',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"severity severity--" + severity().toLowerCase()' },
  template: `<mat-icon>{{ icon() }}</mat-icon>{{ label() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    :host(.severity--low) {
      color: var(--mat-sys-on-surface-variant);
    }
    :host(.severity--medium) {
      color: var(--app-warning);
    }
    :host(.severity--high) {
      color: var(--mat-sys-error);
    }
  `,
})
export class SeverityBadgeComponent {
  readonly severity = input.required<PunchSeverity>();
  protected readonly label = computed(() => PUNCH_SEVERITY_LABELS[this.severity()]);
  protected readonly icon = computed(() => ICONS[this.severity()]);
}
