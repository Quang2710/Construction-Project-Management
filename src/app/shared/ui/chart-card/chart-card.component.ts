import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent } from '../icon/icon.component';

/**
 * Khung biểu đồ có nút chuyển sang dạng bảng (để không phụ thuộc vào màu sắc).
 * Nội dung: <ng-content select="[chart]"> và <ng-content select="[table]">.
 */
@Component({
  selector: 'app-chart-card',
  imports: [
    ButtonModule,
    IconComponent,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="card__header">
      <div>
        <h2 class="card__title">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="card__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <button
        pButton text rounded severity="secondary"
        type="button"
        [pTooltip]="showTable() ? 'Xem biểu đồ' : 'Xem dạng bảng'" tooltipPosition="bottom"
        [attr.aria-label]="showTable() ? 'Xem biểu đồ' : 'Xem dạng bảng'"
        [attr.aria-pressed]="showTable()"
        (click)="showTable.set(!showTable())"
      >
        <app-icon pButtonIcon>{{ showTable() ? 'bar_chart' : 'table_rows' }}</app-icon>
      </button>
    </header>
    <div class="card__body" [hidden]="showTable()"><ng-content select="[chart]" /></div>
    @if (showTable()) {
      <div class="card__table"><ng-content select="[table]" /></div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 16px 20px 20px;
      border: 1px solid var(--app-outline-variant);
      border-radius: var(--app-corner-medium);
      background: var(--app-surface);
    }
    .card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }
    .card__title {
      margin: 0;
      font: var(--app-title-medium);
    }
    .card__subtitle {
      margin: 2px 0 0;
      font: var(--app-body-small);
      color: var(--app-on-surface-variant);
    }
    .card__body {
      position: relative;
      flex: 1;
    }
    .card__table {
      max-height: 320px;
      overflow: auto;
    }
  `,
})
export class ChartCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  protected readonly showTable = signal(false);
}
