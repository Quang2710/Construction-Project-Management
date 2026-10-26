import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from '../../../../core/theme/theme.service';
import { chartTheme } from '../../../../shared/utils/chart-theme';
import { formatVnd, formatVndCompact } from '../../../../shared/utils/currency.utils';
import { CostItemSummary } from '../../models/cost.model';

const ROW_HEIGHT = 44;

/** Cột ngang: dự toán vs thực tế theo hạng mục. */
@Component({
  selector: 'app-cost-items-chart',
  imports: [
    BaseChartDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [style.height.px]="height()">
      <canvas baseChart type="bar" [data]="data()" [options]="options()" aria-label="Biểu đồ dự toán và chi phí thực tế theo hạng mục"></canvas>
    </div>
  `,
  styles: `
    .chart {
      position: relative;
      min-height: 240px;
    }
  `,
})
export class CostItemsChartComponent {
  private readonly theme = inject(ThemeService);
  readonly items = input.required<readonly CostItemSummary[]>();

  protected readonly height = computed(() => Math.max(240, this.items().length * ROW_HEIGHT + 60));

  protected readonly data = computed<ChartData<'bar', number[], string>>(() => {
    const items = this.items();
    const colors = chartTheme(this.theme.mode());
    const bar = { maxBarThickness: 14, borderRadius: 4, borderSkipped: 'start' as const, barPercentage: 0.9, categoryPercentage: 0.7 };
    return {
      labels: items.map((item) => item.code),
      datasets: [
        { ...bar, label: 'Dự toán', data: items.map((item) => item.budget), backgroundColor: colors.series1 },
        { ...bar, label: 'Thực tế', data: items.map((item) => item.actual), backgroundColor: colors.series2 },
      ],
    };
  });

  protected readonly options = computed<ChartOptions<'bar'>>(() => {
    const items = this.items();
    const colors = chartTheme(this.theme.mode());
    return {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false, axis: 'y' },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: { color: colors.textSecondary, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10 },
        },
        tooltip: {
          callbacks: {
            title: (tooltipItems: TooltipItem<'bar'>[]) => {
              const item = items[tooltipItems[0]?.dataIndex ?? -1];
              return item ? `${item.code} · ${item.name}` : '';
            },
            label: (tooltipItem: TooltipItem<'bar'>) => ` ${tooltipItem.dataset.label ?? ''}: ${formatVnd(tooltipItem.parsed.x ?? 0)}`,
            afterBody: (tooltipItems: TooltipItem<'bar'>[]) => {
              const item = items[tooltipItems[0]?.dataIndex ?? -1];
              return item ? [`Đã chi ${item.percentUsed}% · khối lượng ${item.progress}%`] : [];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: colors.grid },
          ticks: { color: colors.textMuted, maxTicksLimit: 5, callback: (value) => formatVndCompact(Number(value)) },
        },
        y: {
          grid: { display: false },
          border: { color: colors.axis },
          ticks: { color: colors.textSecondary },
        },
      },
    };
  });
}
