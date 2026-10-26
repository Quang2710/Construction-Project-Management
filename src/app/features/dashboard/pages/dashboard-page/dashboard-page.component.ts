import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ProgressBarModule } from 'primeng/progressbar';
import { AuthStore } from '../../../../core/auth/auth.store';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { ChartCardComponent } from '../../../../shared/ui/chart-card/chart-card.component';
import { KpiCardComponent } from '../../../../shared/ui/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { TaskDialogService } from '../../../tasks/components/task-dialog/task-dialog.service';
import { Task } from '../../../tasks/models/task.model';
import { CostChartComponent } from '../../components/cost-chart/cost-chart.component';
import { OverdueTaskListComponent } from '../../components/overdue-task-list/overdue-task-list.component';
import { SCurveChartComponent } from '../../components/s-curve-chart/s-curve-chart.component';
import { DashboardStore } from '../../data-access/dashboard.store';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    DatePipe,
    DecimalPipe,
    HasRoleDirective,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    KpiCardComponent,
    ChartCardComponent,
    SCurveChartComponent,
    CostChartComponent,
    OverdueTaskListComponent,
    IconComponent,
    ProgressBarModule,
  ],
  // Chart.js đăng ký ở đây để chỉ nằm trong chunk lazy của trang tổng quan.
  providers: [DashboardStore, provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  private readonly taskDialog = inject(TaskDialogService);
  protected readonly auth = inject(AuthStore);
  protected readonly store = inject(DashboardStore);
  protected readonly today = new Date();

  /** Bảng dữ liệu S-curve: chỉ các tháng đã có số liệu thực tế + kế hoạch. */
  protected readonly sCurveRows = computed(() => {
    const series = this.store.summary()?.sCurve;
    if (!series) {
      return [];
    }
    return series.labels.map((label, index) => ({
      label,
      planned: series.planned[index] ?? 0,
      actual: series.actual[index] ?? null,
    }));
  });

  protected async openTask(task: Task): Promise<void> {
    const result = await this.taskDialog.open({ task });
    if (result) {
      void this.store.load();
    }
  }
}
