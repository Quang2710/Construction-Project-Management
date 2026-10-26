import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { KpiCardComponent } from '../../../../../shared/ui/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { CostStore } from '../../../data-access/cost.store';

/** Báo cáo lãi/lỗ toàn danh mục dự án (ADMIN, PROJECT_MANAGER). */
@Component({
  selector: 'app-profit-loss-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    VndPipe,
    KpiCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <span class="toolbar__summary">
        Lãi/lỗ đến nay = doanh thu ghi nhận theo % khối lượng − chi phí thực tế. Dự báo ngoại suy chi phí theo khối lượng hoàn thành.
      </span>
      <span class="toolbar__spacer"></span>
      <button
        mat-stroked-button
        type="button"
        [disabled]="store.exporting() || store.overview().length === 0"
        (click)="store.exportProfitLoss()"
      >
        @if (store.exporting()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>download</mat-icon>
        }
        Xuất Excel
      </button>
    </div>

    @if (store.overviewLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.overviewError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadOverview()" />
    } @else if (!store.overviewLoading() && store.overview().length === 0) {
      <app-empty-state icon="query_stats" title="Chưa có dự án để lập báo cáo" />
    } @else if (store.overview().length) {
      <div class="kpis">
        <app-kpi-card label="Tổng giá trị hợp đồng" icon="handshake" [value]="totals().contractValue | vnd: 'compact'" />
        <app-kpi-card label="Tổng chi phí thực tế" icon="receipt_long" [value]="totals().actualCost | vnd: 'compact'" />
        <app-kpi-card
          label="Lãi/lỗ đến nay"
          [icon]="totals().profitToDate < 0 ? 'trending_down' : 'trending_up'"
          [value]="totals().profitToDate | vnd: 'compact'"
          [tone]="totals().profitToDate < 0 ? 'critical' : 'neutral'"
        />
        <app-kpi-card
          label="Lãi/lỗ dự báo"
          [icon]="totals().forecastProfit < 0 ? 'trending_down' : 'trending_up'"
          [value]="totals().forecastProfit | vnd: 'compact'"
          [hint]="lossMakers() ? lossMakers() + ' dự án dự báo lỗ' : 'Không có dự án dự báo lỗ'"
          [tone]="totals().forecastProfit < 0 ? 'critical' : lossMakers() ? 'warning' : 'neutral'"
        />
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Dự án</th>
              <th class="num">Giá trị HĐ</th>
              <th class="num hide-sm">Chi phí thực tế</th>
              <th class="num hide-sm">KL</th>
              <th class="num">Lãi/lỗ đến nay</th>
              <th class="num">Lãi/lỗ dự báo</th>
              <th class="num hide-sm">Còn phải thu</th>
            </tr>
          </thead>
          <tbody>
            @for (row of store.overview(); track row.projectId) {
              <tr class="row--clickable" tabindex="0" (click)="openProject.emit(row.projectId)" (keydown.enter)="openProject.emit(row.projectId)">
                <td>
                  <div class="name">{{ row.projectCode }} · {{ row.projectName }}</div>
                  <div class="sub">{{ row.status }}</div>
                </td>
                <td class="num">{{ row.contractValue | vnd: 'compact' }}</td>
                <td class="num hide-sm">{{ row.actualCost | vnd: 'compact' }}</td>
                <td class="num hide-sm">{{ row.progress }}%</td>
                <td class="num" [class.negative]="(row.profitToDate ?? 0) < 0">{{ row.profitToDate | vnd: 'compact' }}</td>
                <td class="num" [class.negative]="(row.forecastProfit ?? 0) < 0" [class.positive]="(row.forecastProfit ?? 0) > 0">
                  {{ row.forecastProfit | vnd: 'compact' }}
                  <div class="sub">{{ row.forecastMargin ?? 0 }}%</div>
                </td>
                <td class="num hide-sm">{{ row.receivable | vnd: 'compact' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styleUrl: './panels.scss',
  styles: `
    .row--clickable {
      cursor: pointer;
    }
    .row--clickable:hover {
      background: var(--mat-sys-surface-container-low);
    }
  `,
})
export class ProfitLossPanelComponent implements OnInit {
  protected readonly store = inject(CostStore);
  protected readonly totals = this.store.overviewTotals;
  protected readonly lossMakers = computed(() => this.store.overview().filter((row) => (row.forecastProfit ?? 0) < 0).length);

  /** Chọn một dự án để xem chi tiết chi phí. */
  readonly openProject = output<string>();

  ngOnInit(): void {
    void this.store.loadOverview();
  }
}
