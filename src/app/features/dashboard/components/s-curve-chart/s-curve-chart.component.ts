import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from '../../../../core/theme/theme.service';
import { SCurveSeries } from '../../models/dashboard.model';
import { chartTheme } from '../../../../shared/utils/chart-theme';

/** Đường cong S lũy kế: kế hoạch vs thực tế (%). */
@Component({
  selector: 'app-s-curve-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <canvas baseChart type="line" [data]="data()" [options]="options()" aria-label="Biểu đồ đường cong S"></canvas>
    </div>
  `,
  styles: `
    .chart {
      position: relative;
      height: 300px;
    }
  `,
})
export class SCurveChartComponent {
  private readonly theme = inject(ThemeService);
  readonly series = input.required<SCurveSeries>();

  protected readonly data = computed<ChartData<'line', (number | null)[], string>>(() => {
    const series = this.series();
    const colors = chartTheme(this.theme.mode());
    return {
      labels: [...series.labels],
      datasets: [
        {
          label: 'Kế hoạch',
          data: [...series.planned],
          borderColor: colors.series1,
          backgroundColor: colors.series1,
          pointBackgroundColor: colors.series1,
          pointBorderColor: colors.surface,
        },
        {
          label: 'Thực tế',
          data: [...series.actual],
          borderColor: colors.series2,
          backgroundColor: colors.series2Wash,
          pointBackgroundColor: colors.series2,
          pointBorderColor: colors.surface,
          fill: 'origin',
        },
      ],
    };
  });

  protected readonly options = computed<ChartOptions<'line'>>(() => {
    const colors = chartTheme(this.theme.mode());
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      elements: {
        line: { borderWidth: 2, tension: 0.35, borderCapStyle: 'round', borderJoinStyle: 'round' },
        point: { radius: 0, hoverRadius: 5, hitRadius: 12, borderWidth: 2 },
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: { color: colors.textSecondary, usePointStyle: true, pointStyle: 'line', boxWidth: 24 },
        },
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'line'>) =>
              item.parsed.y === null ? '' : ` ${item.dataset.label ?? ''}: ${item.parsed.y.toLocaleString('vi-VN')}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: colors.axis },
          ticks: { color: colors.textMuted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          min: 0,
          max: 100,
          border: { display: false },
          grid: { color: colors.grid },
          ticks: { color: colors.textMuted, stepSize: 25, callback: (value) => `${value}%` },
        },
      },
    };
  });
}
