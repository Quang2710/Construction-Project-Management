import { Task } from '../models/task.model';

/** Trễ hạn: đã qua hạn mà chưa hoàn thành. todayIso dạng yyyy-MM-dd. */
export function isTaskOverdue(task: Pick<Task, 'dueDate' | 'status'>, todayIso: string): boolean {
  return task.status !== 'DONE' && task.dueDate < todayIso;
}

const ORDER_STEP = 1000;

/**
 * Tính thứ tự mới khi thả task giữa hai task khác (số thực, chỉ PATCH đúng task được kéo).
 * prev/next là order của task đứng trước/sau vị trí thả.
 */
export function orderBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) {
    return ORDER_STEP;
  }
  if (prev === undefined) {
    return (next as number) - ORDER_STEP;
  }
  if (next === undefined) {
    return prev + ORDER_STEP;
  }
  return (prev + next) / 2;
}
