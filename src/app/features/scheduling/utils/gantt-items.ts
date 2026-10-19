import { GanttItem, GanttItemType, GanttLinkType } from '@worktile/gantt';
import { endOfDay, getUnixTime } from 'date-fns';
import { parseIsoDate } from '../../../shared/utils/date.utils';
import { Task } from '../../tasks/models/task.model';
import { WbsNode } from '../models/wbs.model';
import { CriticalPathResult, edgeKey } from './critical-path';

export type ScheduleOrigin =
  | { readonly kind: 'wbs'; readonly node: WbsNode; readonly progress: number }
  | { readonly kind: 'task'; readonly task: Task; readonly critical: boolean; readonly floatDays: number };

export type ScheduleItem = GanttItem<ScheduleOrigin>;

/** Sự kiện của ngx-gantt có origin kiểu unknown: kiểm tra lại trước khi dùng. */
export function scheduleOrigin(item: GanttItem | undefined): ScheduleOrigin | null {
  const origin: unknown = item?.origin;
  if (typeof origin !== 'object' || origin === null) {
    return null;
  }
  const kind = (origin as Record<string, unknown>)['kind'];
  return kind === 'task' || kind === 'wbs' ? (origin as ScheduleOrigin) : null;
}

/** Màu thanh Gantt: găng = đỏ, xong = xanh lá, còn lại = xanh dương (đã kiểm tra tương phản). */
export const SCHEDULE_COLORS = {
  critical: '#d03b3b',
  done: '#0ca30c',
  normal: '#2a78d6',
  link: '#8a8a8a',
  violation: '#eda100',
} as const;

function startUnix(iso: string): number {
  return getUnixTime(parseIsoDate(iso));
}

function endUnix(iso: string): number {
  return getUnixTime(endOfDay(parseIsoDate(iso)));
}

/**
 * Dựng cây Gantt: hạng mục WBS (dạng range, ngày = khoảng của công việc con) chứa hạng mục con và công việc.
 * Liên kết (links) đặt trên công việc trước, trỏ tới công việc sau (FS).
 */
export function buildGanttItems(
  wbs: readonly WbsNode[],
  tasks: readonly Task[],
  cpm: CriticalPathResult,
  editable: boolean,
): ScheduleItem[] {
  const successors = new Map<string, Task[]>();
  for (const task of tasks) {
    for (const predecessorId of task.dependencyIds) {
      successors.set(predecessorId, [...(successors.get(predecessorId) ?? []), task]);
    }
  }

  const toTaskItem = (task: Task): ScheduleItem => {
    const critical = cpm.critical.has(task.id);
    const color = task.status === 'DONE' ? SCHEDULE_COLORS.done : critical ? SCHEDULE_COLORS.critical : SCHEDULE_COLORS.normal;
    return {
      id: task.id,
      title: task.title,
      start: startUnix(task.startDate),
      end: endUnix(task.dueDate),
      progress: task.percentComplete / 100,
      color,
      // Mốc: ẩn thanh mặc định, template vẽ hình thoi.
      barStyle: task.isMilestone ? { background: 'transparent', boxShadow: 'none', overflow: 'visible' } : undefined,
      draggable: editable,
      linkable: editable,
      links: (successors.get(task.id) ?? []).map((successor) => {
        const key = edgeKey(task.id, successor.id);
        const onCritical = critical && cpm.critical.has(successor.id);
        return {
          type: GanttLinkType.fs,
          link: successor.id,
          color: cpm.violations.has(key)
            ? SCHEDULE_COLORS.violation
            : onCritical
              ? SCHEDULE_COLORS.critical
              : SCHEDULE_COLORS.link,
        };
      }),
      origin: { kind: 'task', task, critical, floatDays: cpm.floatDays.get(task.id) ?? 0 },
    };
  };

  const sortByStart = (a: Task, b: Task): number => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'vi');
  const knownWbs = new Set(wbs.map((node) => node.id));

  const buildNode = (node: WbsNode): ScheduleItem | null => {
    const children = [
      ...wbs.filter((child) => child.parentId === node.id).map(buildNode),
      ...tasks.filter((task) => task.wbsId === node.id).sort(sortByStart).map(toTaskItem),
    ].filter((item): item is ScheduleItem => item !== null);
    const leafTasks = collectTasks(children);
    if (leafTasks.length === 0) {
      // Hạng mục rỗng vẫn hiện trong bảng để người dùng thêm công việc vào.
      return { id: node.id, title: `${node.code}. ${node.name}`, children: [], expandable: false, draggable: false, linkable: false, type: GanttItemType.range, origin: { kind: 'wbs', node, progress: 0 } };
    }
    const start = leafTasks.reduce((min, task) => (task.startDate < min ? task.startDate : min), leafTasks[0].startDate);
    const end = leafTasks.reduce((max, task) => (task.dueDate > max ? task.dueDate : max), leafTasks[0].dueDate);
    const progress = Math.round(leafTasks.reduce((sum, task) => sum + task.percentComplete, 0) / leafTasks.length);
    return {
      id: node.id,
      title: `${node.code}. ${node.name}`,
      start: startUnix(start),
      end: endUnix(end),
      type: GanttItemType.range,
      expandable: true,
      expanded: true,
      draggable: false,
      linkable: false,
      children,
      progress: progress / 100,
      origin: { kind: 'wbs', node, progress },
    };
  };

  return [
    ...wbs.filter((node) => node.parentId === null).map(buildNode),
    ...tasks.filter((task) => !task.wbsId || !knownWbs.has(task.wbsId)).sort(sortByStart).map(toTaskItem),
  ].filter((item): item is ScheduleItem => item !== null);
}

function collectTasks(items: readonly ScheduleItem[]): Task[] {
  return items.flatMap((item) => {
    if (item.origin?.kind === 'task') {
      return [item.origin.task];
    }
    return collectTasks((item.children ?? []) as ScheduleItem[]);
  });
}
