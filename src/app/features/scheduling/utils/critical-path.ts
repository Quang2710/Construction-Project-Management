import { differenceInCalendarDays } from 'date-fns';
import { parseIsoDate } from '../../../shared/utils/date.utils';

export interface ScheduleTask {
  readonly id: string;
  readonly startDate: string;
  readonly dueDate: string;
  readonly dependencyIds: readonly string[];
}

export interface CriticalPathResult {
  /** Công việc thuộc đường găng (dự trữ = 0). */
  readonly critical: ReadonlySet<string>;
  /** Thời gian dự trữ (ngày) của từng công việc. */
  readonly floatDays: ReadonlyMap<string, number>;
  /** Cạnh "trước>sau" vi phạm FS: công việc sau bắt đầu trước khi công việc trước xong. */
  readonly violations: ReadonlySet<string>;
  /** Ngày hoàn thành dự kiến (yyyy-MM-dd) hoặc null nếu không có công việc. */
  readonly finishDate: string | null;
}

export function edgeKey(predecessorId: string, successorId: string): string {
  return `${predecessorId}>${successorId}`;
}

/**
 * Đường găng (CPM) mức đơn giản trên lịch hiện tại, phụ thuộc Finish-to-Start:
 * backward pass tính ngày bắt đầu muộn nhất; công việc có dự trữ ≤ 0 là găng.
 */
export function computeCriticalPath(tasks: readonly ScheduleTask[]): CriticalPathResult {
  if (tasks.length === 0) {
    return { critical: new Set(), floatDays: new Map(), violations: new Set(), finishDate: null };
  }
  const origin = parseIsoDate(tasks.reduce((min, task) => (task.startDate < min ? task.startDate : min), tasks[0].startDate));
  const day = (iso: string): number => differenceInCalendarDays(parseIsoDate(iso), origin);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const successors = new Map<string, string[]>(tasks.map((task) => [task.id, []]));
  const indegree = new Map<string, number>(tasks.map((task) => [task.id, 0]));
  const violations = new Set<string>();

  for (const task of tasks) {
    for (const predecessorId of task.dependencyIds) {
      const predecessor = byId.get(predecessorId);
      if (!predecessor) {
        continue;
      }
      successors.get(predecessorId)?.push(task.id);
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      if (task.startDate < predecessor.dueDate) {
        violations.add(edgeKey(predecessorId, task.id));
      }
    }
  }

  // Thứ tự topo (Kahn); công việc nằm trong vòng lặp (nếu có) bị bỏ qua.
  const order: string[] = [];
  const queue = tasks.filter((task) => indegree.get(task.id) === 0).map((task) => task.id);
  while (queue.length) {
    const id = queue.shift() ?? '';
    order.push(id);
    for (const next of successors.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
      }
    }
  }

  const finish = Math.max(...tasks.map((task) => day(task.dueDate)));
  const latestStart = new Map<string, number>();
  const floatDays = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const task = byId.get(id);
    if (!task) {
      continue;
    }
    const duration = day(task.dueDate) - day(task.startDate);
    const next = successors.get(id) ?? [];
    const latestFinish = next.length ? Math.min(...next.map((successor) => latestStart.get(successor) ?? finish)) : finish;
    latestStart.set(id, latestFinish - duration);
    floatDays.set(id, latestFinish - duration - day(task.startDate));
  }

  const critical = new Set([...floatDays].filter(([, float]) => float <= 0).map(([id]) => id));
  const finishTask = tasks.find((task) => day(task.dueDate) === finish);
  return { critical, floatDays, violations, finishDate: finishTask?.dueDate ?? null };
}
