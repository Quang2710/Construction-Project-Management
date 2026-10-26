import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type KpiTone = 'neutral' | 'warning' | 'critical';

/** Thẻ KPI: nhãn, giá trị, mô tả phụ; màu trạng thái luôn đi kèm icon. */
@Component({
  selector: 'app-kpi-card',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"kpi kpi--" + tone()' },
  template: `
    <span class="kpi__icon" aria-hidden="true"><app-icon>{{ icon() }}</app-icon></span>
    <div class="kpi__body">
      <p class="kpi__label">{{ label() }}</p>
      <p class="kpi__value">{{ value() }}</p>
      @if (hint()) {
        <p class="kpi__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px 20px;
      border: 1px solid var(--app-outline-variant);
      border-radius: var(--app-corner-medium);
      background: var(--app-surface);
    }
    .kpi__icon {
      display: inline-flex;
      padding: 10px;
      border-radius: 12px;
      background: var(--app-primary-container);
      color: var(--app-on-primary-container);
    }
    :host(.kpi--warning) .kpi__icon {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.kpi--critical) .kpi__icon {
      background: var(--app-error-container);
      color: var(--app-on-error-container);
    }
    .kpi__label {
      margin: 0;
      font: var(--app-label-large);
      color: var(--app-on-surface-variant);
    }
    .kpi__value {
      margin: 2px 0 0;
      font: var(--app-headline-medium);
      font-weight: 600;
    }
    .kpi__hint {
      margin: 2px 0 0;
      font: var(--app-body-small);
      color: var(--app-on-surface-variant);
    }
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly icon = input.required<string>();
  readonly hint = input('');
  readonly tone = input<KpiTone>('neutral');
}
