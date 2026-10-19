import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Khung biểu đồ có nút chuyển sang dạng bảng (để không phụ thuộc vào màu sắc).
 * Nội dung: <ng-content select="[chart]"> và <ng-content select="[table]">.
 */
@Component({
  selector: 'app-chart-card',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
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
        mat-icon-button
        type="button"
        [matTooltip]="showTable() ? 'Xem biểu đồ' : 'Xem dạng bảng'"
        [attr.aria-label]="showTable() ? 'Xem biểu đồ' : 'Xem dạng bảng'"
        [attr.aria-pressed]="showTable()"
        (click)="showTable.set(!showTable())"
      >
        <mat-icon>{{ showTable() ? 'bar_chart' : 'table_rows' }}</mat-icon>
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
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface);
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
      font: var(--mat-sys-title-medium);
    }
    .card__subtitle {
      margin: 2px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
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
