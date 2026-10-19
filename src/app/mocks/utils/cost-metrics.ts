import { TaskRecord, WbsRecord } from '../models/mock-records';
import { actualProgress } from './project-metrics';

/** Id của hạng mục WBS và mọi hạng mục con cháu. */
export function wbsSubtree(wbs: readonly WbsRecord[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const node of wbs) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        added = true;
      }
    }
  }
  return ids;
}

/** % khối lượng của một hạng mục chi phí = % hoàn thành các công việc trong nhánh WBS tương ứng. */
export function costItemProgress(
  wbsId: string | null,
  wbs: readonly WbsRecord[],
  tasks: readonly TaskRecord[],
): number {
  if (!wbsId) {
    return actualProgress(tasks);
  }
  const ids = wbsSubtree(wbs, wbsId);
  return actualProgress(tasks.filter((task) => task.wbsId !== null && ids.has(task.wbsId)));
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
