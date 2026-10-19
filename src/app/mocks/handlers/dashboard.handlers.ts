import { addMonths, endOfMonth, format, isAfter, startOfMonth } from 'date-fns';
import { http, HttpResponse } from 'msw';
import { DashboardSummary, SCurveSeries } from '../../features/dashboard/models/dashboard.model';
import { toIsoDate, parseIsoDate } from '../../shared/utils/date.utils';
import { db } from '../db';
import { ProjectRecord, TaskRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, simulateNetwork } from '../utils/http.utils';
import { actualProgress, isOverdue, plannedProgressAt } from '../utils/project-metrics';
import { groupTasksByProject, toProjectDto, toTaskDto, visibleProjects } from '../utils/serializers';

const MAX_MONTHS = 60;
const OVERDUE_LIST_SIZE = 8;

interface WeightedProject {
  readonly record: ProjectRecord;
  readonly progress: number;
  /** Tỉ lệ thực tế / kế hoạch hiện tại, dùng để dựng lại đường thực tế quá khứ. */
  readonly performance: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * S-curve danh mục: % lũy kế có trọng số theo ngân sách.
 * Đường thực tế quá khứ được nội suy từ hiệu suất hiện tại của từng dự án.
 */
function buildSCurve(projects: readonly WeightedProject[], now: Date): SCurveSeries {
  const totalBudget = projects.reduce((sum, item) => sum + item.record.budget, 0);
  if (projects.length === 0 || totalBudget === 0) {
    return { labels: [], planned: [], actual: [] };
  }
  const firstStart = projects.map((item) => item.record.startDate).sort()[0];
  const lastEnd = projects.map((item) => item.record.endDate).sort().at(-1) ?? firstStart;
  let month = startOfMonth(parseIsoDate(firstStart));
  const lastMonth = startOfMonth(parseIsoDate(lastEnd));

  const labels: string[] = [];
  const planned: number[] = [];
  const actual: (number | null)[] = [];

  while (!isAfter(month, lastMonth) && labels.length < MAX_MONTHS) {
    const monthEnd = endOfMonth(month);
    const isFuture = isAfter(month, now);
    const at = isAfter(monthEnd, now) ? now : monthEnd;
    let plannedSum = 0;
    let actualSum = 0;
    for (const item of projects) {
      const plannedAtMonthEnd = plannedProgressAt(item.record, monthEnd);
      plannedSum += item.record.budget * plannedAtMonthEnd;
      const actualAt = Math.min(item.progress, plannedProgressAt(item.record, at) * item.performance);
      actualSum += item.record.budget * actualAt;
    }
    labels.push(format(month, 'MM/yyyy'));
    planned.push(round1(plannedSum / totalBudget));
    actual.push(isFuture ? null : round1(actualSum / totalBudget));
    month = addMonths(month, 1);
  }
  return { labels, planned, actual };
}

function byMostOverdue(a: TaskRecord, b: TaskRecord): number {
  return a.dueDate.localeCompare(b.dueDate);
}

export const dashboardHandlers = [
  http.get(apiUrl('/dashboard/summary'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }

    const now = new Date();
    const today = toIsoDate(now);
    const projects = visibleProjects(auth.user).filter((project) => project.status !== 'CANCELLED');
    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = db.tasks.filter((task) => projectIds.has(task.projectId));
    const tasksByProject = groupTasksByProject(tasks);
    const dtos = projects.map((record) => toProjectDto(record, tasksByProject.get(record.id) ?? [], now));
    const overdue = tasks.filter((task) => isOverdue(task, today)).sort(byMostOverdue);

    const weighted: WeightedProject[] = projects.map((record) => {
      const progress = actualProgress(tasksByProject.get(record.id) ?? []);
      const plannedNow = plannedProgressAt(record, now);
      return { record, progress, performance: plannedNow > 0 ? progress / plannedNow : 1 };
    });

    const summary: DashboardSummary = {
      kpis: {
        totalProjects: dtos.length,
        activeProjects: dtos.filter((project) => project.status === 'IN_PROGRESS').length,
        delayedProjects: dtos.filter((project) => project.isDelayed).length,
        overBudgetProjects: dtos.filter((project) => project.isOverBudget).length,
        overdueTasks: overdue.length,
      },
      sCurve: buildSCurve(weighted, now),
      costByProject: dtos.map((project) => ({
        projectId: project.id,
        code: project.code,
        name: project.name,
        budget: project.budget,
        actualCost: project.actualCost,
      })),
      overdueTasks: overdue.slice(0, OVERDUE_LIST_SIZE).map(toTaskDto),
    };
    return HttpResponse.json(summary);
  }),
];
