import { Task } from '../../tasks/models/task.model';

export interface DashboardKpis {
  readonly totalProjects: number;
  /** Dự án đang thi công. */
  readonly activeProjects: number;
  readonly delayedProjects: number;
  readonly overBudgetProjects: number;
  readonly overdueTasks: number;
}

/** Đường cong S lũy kế (%) theo tháng, danh mục dự án có trọng số theo ngân sách. */
export interface SCurveSeries {
  /** Nhãn tháng "MM/yyyy". */
  readonly labels: readonly string[];
  readonly planned: readonly number[];
  /** null cho các tháng trong tương lai. */
  readonly actual: readonly (number | null)[];
}

export interface ProjectCost {
  readonly projectId: string;
  readonly code: string;
  readonly name: string;
  readonly budget: number;
  readonly actualCost: number;
}

export interface DashboardSummary {
  readonly kpis: DashboardKpis;
  readonly sCurve: SCurveSeries;
  readonly costByProject: readonly ProjectCost[];
  readonly overdueTasks: readonly Task[];
}
