import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type KpiTone = 'neutral' | 'warning' | 'critical';

/** Thẻ KPI: nhãn, giá trị, mô tả phụ; màu trạng thái luôn đi kèm icon. */
@Component({
  selector: 'app-kpi-card',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"kpi kpi--" + tone()' },
  template: `
    <span class="kpi__icon" aria-hidden="true"><mat-icon>{{ icon() }}</mat-icon></span>
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
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface);
    }
    .kpi__icon {
      display: inline-flex;
      padding: 10px;
      border-radius: 12px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    :host(.kpi--warning) .kpi__icon {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.kpi--critical) .kpi__icon {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .kpi__label {
      margin: 0;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .kpi__value {
      margin: 2px 0 0;
      font: var(--mat-sys-headline-medium);
      font-weight: 600;
    }
    .kpi__hint {
      margin: 2px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
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
