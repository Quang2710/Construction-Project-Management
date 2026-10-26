import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { ChartCardComponent } from '../../../../../shared/ui/chart-card/chart-card.component';
import { KpiCardComponent, KpiTone } from '../../../../../shared/ui/kpi-card/kpi-card.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { formatVndCompact } from '../../../../../shared/utils/currency.utils';
import { CashFlowChartComponent } from '../../../components/cash-flow-chart/cash-flow-chart.component';
import { CostItemsChartComponent } from '../../../components/cost-items-chart/cost-items-chart.component';
import { CostStore } from '../../../data-access/cost.store';
import { COST_CATEGORY_LABELS, CostItemSummary } from '../../../models/cost.model';

interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly hint: string;
  readonly tone: KpiTone;
}

type MeterTone = 'ok' | 'warn' | 'over';

@Component({
  selector: 'app-overview-panel',
  imports: [
    MatIconModule,
    MatProgressBarModule,
    VndPipe,
    ChartCardComponent,
    KpiCardComponent,
    ErrorStateComponent,
    CashFlowChartComponent,
    CostItemsChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.summaryLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.summaryError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadSummary()" />
    } @else if (store.summary(); as summary) {
      <div class="kpis">
        @for (kpi of kpis(); track kpi.label) {
          <app-kpi-card [label]="kpi.label" [value]="kpi.value" [icon]="kpi.icon" [hint]="kpi.hint" [tone]="kpi.tone" />
        }
      </div>

      @if (store.overrunItems().length) {
        <div class="alert" role="status">
          <mat-icon>warning</mat-icon>
          <span>
            {{ store.overrunItems().length }} hạng mục vượt dự toán hoặc chi nhanh hơn khối lượng hoàn thành (lệch quá 10%):
            {{ overrunCodes() }}
          </span>
        </div>
      }

      <div class="grid">
        <app-chart-card title="Dự toán vs thực tế theo hạng mục" subtitle="Vạch đen trên thanh = % khối lượng hoàn thành">
          <app-cost-items-chart chart [items]="summary.items" />
          <div table class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Hạng mục</th>
                  <th class="num">Dự toán</th>
                  <th class="num">Thực tế</th>
                  <th class="num hide-sm">Còn lại</th>
                  <th class="num">% đã chi</th>
                </tr>
              </thead>
              <tbody>
                @for (item of items(); track item.id) {
                  <tr [class.row--warn]="item.overrun">
                    <td>
                      <div class="name">{{ item.code }} · {{ item.name }}</div>
                      @if (item.actual > item.budget) {
                        <span class="flag flag--over"><mat-icon>error</mat-icon> Vượt dự toán</span>
                      } @else if (item.overrun) {
                        <span class="flag"><mat-icon>warning</mat-icon> Chi nhanh hơn khối lượng</span>
                      }
                    </td>
                    <td class="num">{{ item.budget | vnd: 'compact' }}</td>
                    <td class="num">{{ item.actual | vnd: 'compact' }}</td>
                    <td class="num hide-sm" [class.negative]="item.variance < 0">{{ item.variance | vnd: 'compact' }}</td>
                    <td class="num">
                      {{ item.percentUsed }}% <span class="sub">/ KL {{ item.progress }}%</span>
                      <div [class]="'meter meter--' + item.tone">
                        <div class="meter__fill" [style.width.%]="item.percentUsed"></div>
                        <div class="meter__mark" [style.left.%]="item.progress"></div>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td>Tổng cộng</td>
                  <td class="num">{{ summary.costBudget | vnd: 'compact' }}</td>
                  <td class="num">{{ summary.actualCost | vnd: 'compact' }}</td>
                  <td class="num hide-sm" [class.negative]="summary.costBudget < summary.actualCost">
                    {{ summary.costBudget - summary.actualCost | vnd: 'compact' }}
                  </td>
                  <td class="num">{{ budgetUsed() }}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </app-chart-card>

        <section class="card">
          <h2 class="card__title">Chi phí theo loại</h2>
          <ul class="categories">
            @for (row of categories(); track row.category) {
              <li>
                <div class="category__row">
                  <span>{{ row.label }}</span>
                  <span class="num">{{ row.amount | vnd: 'compact' }} · {{ row.share }}%</span>
                </div>
                <div class="category__bar"><div class="category__fill" [style.width.%]="row.share"></div></div>
              </li>
            }
          </ul>
        </section>
      </div>

      <app-chart-card title="Dòng tiền 12 tháng gần nhất" subtitle="Chi phí thực tế và tiền chủ đầu tư đã thanh toán">
        <app-cash-flow-chart chart [months]="summary.monthly" />
        <div table class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Tháng</th><th class="num">Chi phí</th><th class="num">Đã thu</th></tr>
            </thead>
            <tbody>
              @for (point of summary.monthly; track point.month) {
                <tr>
                  <td>{{ point.month }}</td>
                  <td class="num">{{ point.cost | vnd: 'compact' }}</td>
                  <td class="num">{{ point.received | vnd: 'compact' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-chart-card>
    }
  `,
  styleUrl: './panels.scss',
})
export class OverviewPanelComponent {
  protected readonly store = inject(CostStore);

  protected readonly overrunCodes = computed(() =>
    this.store
      .overrunItems()
      .map((item) => item.code)
      .join(', '),
  );

  protected readonly items = computed<(CostItemSummary & { readonly tone: MeterTone })[]>(() =>
    (this.store.summary()?.items ?? []).map((item) => ({
      ...item,
      tone: item.actual > item.budget ? 'over' : item.overrun ? 'warn' : 'ok',
    })),
  );

  protected readonly budgetUsed = computed(() => {
    const summary = this.store.summary();
    return summary && summary.costBudget > 0 ? Math.round((summary.actualCost / summary.costBudget) * 100) : 0;
  });

  protected readonly categories = computed(() => {
    const rows = this.store.summary()?.byCategory ?? [];
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return rows.map((row) => ({
      ...row,
      label: COST_CATEGORY_LABELS[row.category],
      share: total > 0 ? Math.round((row.amount / total) * 100) : 0,
    }));
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const summary = this.store.summary();
    if (!summary) {
      return [];
    }
    const kpis: Kpi[] = [
      {
        label: 'Giá trị hợp đồng',
        value: formatVndCompact(summary.contractValue),
        icon: 'handshake',
        hint: `Gốc ${formatVndCompact(summary.originalContract)} + phát sinh ${formatVndCompact(summary.approvedChanges)}`,
        tone: 'neutral',
      },
      {
        label: 'Chi phí thực tế',
        value: formatVndCompact(summary.actualCost),
        icon: 'receipt_long',
        hint: `${this.budgetUsed()}% dự toán ${formatVndCompact(summary.costBudget)} · KL ${summary.progress}%`,
        tone: summary.actualCost > summary.costBudget ? 'critical' : this.store.overrunItems().length ? 'warning' : 'neutral',
      },
      {
        label: 'Đã thu',
        value: formatVndCompact(summary.received),
        icon: 'account_balance',
        hint: `Còn phải thu ${formatVndCompact(summary.receivable)}`,
        tone: this.store.overduePayments().length ? 'warning' : 'neutral',
      },
    ];
    // forecastProfit = null với CLIENT: hiển thị khối lượng thay cho lãi/lỗ.
    if (summary.forecastProfit !== null) {
      kpis.push({
        label: 'Lãi/lỗ dự báo',
        value: formatVndCompact(summary.forecastProfit),
        icon: summary.forecastProfit < 0 ? 'trending_down' : 'trending_up',
        hint: `Tỷ suất ${summary.forecastMargin ?? 0}% · đến nay ${formatVndCompact(summary.profitToDate ?? 0)}`,
        tone: summary.forecastProfit < 0 ? 'critical' : (summary.forecastMargin ?? 0) < 5 ? 'warning' : 'neutral',
      });
    } else {
      kpis.push({
        label: 'Khối lượng hoàn thành',
        value: `${summary.progress}%`,
        icon: 'construction',
        hint: `Giá trị ghi nhận ${formatVndCompact(summary.earnedRevenue)}`,
        tone: 'neutral',
      });
    }
    return kpis;
  });

}
