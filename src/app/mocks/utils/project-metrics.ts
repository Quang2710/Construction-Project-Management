import { ProjectTaskStats } from '../../features/projects/models/project.model';
import { parseIsoDate } from '../../shared/utils/date.utils';
import { ProjectRecord, TaskRecord } from '../models/mock-records';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Chậm tiến độ khi thực tế thấp hơn kế hoạch từ 10 điểm % trở lên. */
const DELAY_THRESHOLD = 10;
/** Vượt ngân sách khi chi phí dự báo hoàn thành vượt 5% ngân sách. */
const OVER_BUDGET_TOLERANCE = 1.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Đường cong S chuẩn hoá (smoothstep): chậm lúc đầu, nhanh giữa kỳ, chậm lúc cuối. */
export function sCurve(fraction: number): number {
  const x = clamp01(fraction);
  return x * x * (3 - 2 * x);
}

/** Hàm ngược của sCurve: dùng để rải hạn công việc khớp với kế hoạch dạng S. */
export function inverseSCurve(value: number): number {
  const y = clamp01(value);
  return 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3);
}

export function elapsedFraction(project: Pick<ProjectRecord, 'startDate' | 'endDate'>, at: Date): number {
  const start = parseIsoDate(project.startDate).getTime();
  const end = parseIsoDate(project.endDate).getTime() + DAY_MS;
  return end <= start ? 1 : clamp01((at.getTime() - start) / (end - start));
}

/** % kế hoạch tại thời điểm `at`. */
export function plannedProgressAt(project: Pick<ProjectRecord, 'startDate' | 'endDate'>, at: Date): number {
  return Math.round(sCurve(elapsedFraction(project, at)) * 100);
}

/** % thực tế = trung bình % hoàn thành của các công việc. */
export function actualProgress(tasks: readonly TaskRecord[]): number {
  if (tasks.length === 0) {
    return 0;
  }
  return Math.round(tasks.reduce((sum, task) => sum + task.percentComplete, 0) / tasks.length);
}

export function isOverdue(task: Pick<TaskRecord, 'dueDate' | 'status'>, todayIso: string): boolean {
  return task.status !== 'DONE' && task.dueDate < todayIso;
}

export function taskStats(tasks: readonly TaskRecord[], todayIso: string): ProjectTaskStats {
  return {
    total: tasks.length,
    done: tasks.filter((task) => task.status === 'DONE').length,
    overdue: tasks.filter((task) => isOverdue(task, todayIso)).length,
  };
}

export function isProjectDelayed(project: ProjectRecord, progress: number, plannedProgress: number, todayIso: string): boolean {
  if (project.status !== 'IN_PROGRESS' && project.status !== 'ON_HOLD') {
    return false;
  }
  return plannedProgress - progress >= DELAY_THRESHOLD || (project.endDate < todayIso && progress < 100);
}

/** Vượt ngân sách: đã chi quá ngân sách, hoặc chi phí dự báo (theo % hoàn thành) vượt ngưỡng. */
export function isProjectOverBudget(project: ProjectRecord, progress: number): boolean {
  if (project.actualCost > project.budget) {
    return true;
  }
  if (progress <= 0 || project.status === 'CANCELLED') {
    return false;
  }
  const forecast = (project.actualCost * 100) / progress;
  return forecast > project.budget * OVER_BUDGET_TOLERANCE;
}
