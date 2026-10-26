import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from '../../../../core/theme/theme.service';
import { chartTheme } from '../../../../shared/utils/chart-theme';
import { formatVnd, formatVndCompact } from '../../../../shared/utils/currency.utils';
import { CostMonthPoint } from '../../models/cost.model';

/** Cột theo tháng: chi phí phát sinh vs tiền chủ đầu tư thanh toán (12 tháng gần nhất). */
@Component({
  selector: 'app-cash-flow-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <canvas baseChart type="bar" [data]="data()" [options]="options()" aria-label="Biểu đồ dòng tiền theo tháng"></canvas>
    </div>
  `,
  styles: `
    .chart {
      position: relative;
      height: 280px;
    }
  `,
})
export class CashFlowChartComponent {
  private readonly theme = inject(ThemeService);
  readonly months = input.required<readonly CostMonthPoint[]>();

  protected readonly data = computed<ChartData<'bar', number[], string>>(() => {
    const months = this.months();
    const colors = chartTheme(this.theme.mode());
    const bar = { maxBarThickness: 18, borderRadius: 4, borderSkipped: 'start' as const };
    return {
      labels: months.map((point) => point.month),
      datasets: [
        { ...bar, label: 'Chi phí', data: months.map((point) => point.cost), backgroundColor: colors.series2 },
        { ...bar, label: 'Đã thu', data: months.map((point) => point.received), backgroundColor: colors.series1 },
      ],
    };
  });

  protected readonly options = computed<ChartOptions<'bar'>>(() => {
    const colors = chartTheme(this.theme.mode());
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: { color: colors.textSecondary, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10 },
        },
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'bar'>) => ` ${item.dataset.label ?? ''}: ${formatVnd(item.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: colors.axis },
          ticks: { color: colors.textSecondary, maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: colors.grid },
          ticks: { color: colors.textMuted, maxTicksLimit: 5, callback: (value) => formatVndCompact(Number(value)) },
        },
      },
    };
  });
}
