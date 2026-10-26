import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from '../../../../core/theme/theme.service';
import { formatVnd, formatVndCompact } from '../../../../shared/utils/currency.utils';
import { ProjectCost } from '../../models/dashboard.model';
import { chartTheme } from '../../../../shared/utils/chart-theme';

const ROW_HEIGHT = 44;

/** Cột ngang: ngân sách vs đã chi theo dự án (một trục, cùng đơn vị VND). */
@Component({
  selector: 'app-cost-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [style.height.px]="height()">
      <canvas baseChart type="bar" [data]="data()" [options]="options()" aria-label="Biểu đồ chi phí theo dự án"></canvas>
    </div>
  `,
  styles: `
    .chart {
      position: relative;
      min-height: 240px;
    }
  `,
})
export class CostChartComponent {
  private readonly theme = inject(ThemeService);
  readonly costs = input.required<readonly ProjectCost[]>();

  protected readonly height = computed(() => Math.max(240, this.costs().length * ROW_HEIGHT + 60));

  protected readonly data = computed<ChartData<'bar', number[], string>>(() => {
    const costs = this.costs();
    const colors = chartTheme(this.theme.mode());
    const bar = { maxBarThickness: 14, borderRadius: 4, borderSkipped: 'start' as const, barPercentage: 0.9, categoryPercentage: 0.7 };
    return {
      labels: costs.map((cost) => cost.code),
      datasets: [
        { ...bar, label: 'Ngân sách', data: costs.map((cost) => cost.budget), backgroundColor: colors.series1 },
        { ...bar, label: 'Đã chi', data: costs.map((cost) => cost.actualCost), backgroundColor: colors.series2 },
      ],
    };
  });

  protected readonly options = computed<ChartOptions<'bar'>>(() => {
    const costs = this.costs();
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
            title: (items: TooltipItem<'bar'>[]) => {
              const cost = costs[items[0]?.dataIndex ?? -1];
              return cost ? `${cost.code} · ${cost.name}` : '';
            },
            label: (item: TooltipItem<'bar'>) => ` ${item.dataset.label ?? ''}: ${formatVnd(item.parsed.x ?? 0)}`,
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
