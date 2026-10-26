import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PUNCH_SEVERITY_LABELS, PunchSeverity } from '../../models/quality.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

const ICONS: Readonly<Record<PunchSeverity, string>> = {
  LOW: 'keyboard_arrow_down',
  MEDIUM: 'drag_handle',
  HIGH: 'keyboard_double_arrow_up',
};

/** Mức độ lỗi: luôn kèm icon + chữ, không chỉ dựa vào màu. */
@Component({
  selector: 'app-severity-badge',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"severity severity--" + severity().toLowerCase()' },
  template: `<app-icon>{{ icon() }}</app-icon>{{ label() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font: var(--app-label-medium);
      white-space: nowrap;
    }
    app-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    :host(.severity--low) {
      color: var(--app-on-surface-variant);
    }
    :host(.severity--medium) {
      color: var(--app-warning);
    }
    :host(.severity--high) {
      color: var(--app-error);
    }
  `,
})
export class SeverityBadgeComponent {
  readonly severity = input.required<PunchSeverity>();
  protected readonly label = computed(() => PUNCH_SEVERITY_LABELS[this.severity()]);
  protected readonly icon = computed(() => ICONS[this.severity()]);
}
