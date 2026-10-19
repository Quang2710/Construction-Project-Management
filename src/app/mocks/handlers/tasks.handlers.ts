import { addDays, differenceInCalendarDays } from 'date-fns';
import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskCreateRequest,
  TaskPriority,
  TaskStatus,
  TaskUpdateRequest,
} from '../../features/tasks/models/task.model';
import { ApiError } from '../../shared/models/api.model';
import { UserRole } from '../../shared/models/user.model';
import { isValidIsoDate, parseIsoDate, toIsoDate } from '../../shared/utils/date.utils';
import { db } from '../db';
import { TaskRecord, UserRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { canViewProject, newId, toCommentDto, toTaskDto } from '../utils/serializers';

const SEARCH_FIELDS: readonly (keyof Task & string)[] = ['title', 'description'];
/** Kanban cần lấy toàn bộ task một lần nên cho phép pageSize lớn hơn mặc định. */
const MAX_TASK_PAGE_SIZE = 500;

type Failure = { readonly ok: false; readonly response: HttpResponse<ApiError> };
type Success<T> = { readonly ok: true; readonly value: T };

function invalid(message: string): Failure {
  return { ok: false, response: errorResponse(422, 'VALIDATION_ERROR', message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && (TASK_PRIORITIES as readonly string[]).includes(value);
}

/** Kiểm tra các field có mặt trong body (dùng chung cho POST và PATCH). */
function validateTaskFields(body: Record<string, unknown>): Success<TaskUpdateRequest> | Failure {
  const value: { -readonly [K in keyof TaskUpdateRequest]: TaskUpdateRequest[K] } = {};

  if ('title' in body) {
    const title = body['title'];
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
      return invalid('Tiêu đề công việc là bắt buộc (tối đa 200 ký tự).');
    }
    value.title = title.trim();
  }
  if ('description' in body) {
    const description = body['description'];
    if (typeof description !== 'string' || description.length > 4000) {
      return invalid('Mô tả tối đa 4000 ký tự.');
    }
    value.description = description.trim();
  }
  if ('status' in body) {
    if (!isTaskStatus(body['status'])) {
      return invalid('Trạng thái công việc không hợp lệ.');
    }
    value.status = body['status'];
  }
  if ('priority' in body) {
    if (!isTaskPriority(body['priority'])) {
      return invalid('Mức ưu tiên không hợp lệ.');
    }
    value.priority = body['priority'];
  }
  if ('assigneeId' in body) {
    const assigneeId = body['assigneeId'];
    if (assigneeId !== null && (typeof assigneeId !== 'string' || !db.users.findById(assigneeId))) {
      return invalid('Người phụ trách không tồn tại.');
    }
    value.assigneeId = assigneeId;
  }
  if ('dueDate' in body) {
    if (!isValidIsoDate(body['dueDate'])) {
      return invalid('Hạn hoàn thành không hợp lệ.');
    }
    value.dueDate = body['dueDate'];
  }
  if ('percentComplete' in body) {
    const percent = body['percentComplete'];
    if (typeof percent !== 'number' || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      return invalid('% hoàn thành phải là số nguyên từ 0 đến 100.');
    }
    value.percentComplete = percent;
  }
  if ('labels' in body) {
    const labels = body['labels'];
    if (
      !Array.isArray(labels) ||
      labels.length > 10 ||
      !labels.every((label): label is string => typeof label === 'string' && label.trim().length > 0 && label.length <= 30)
    ) {
      return invalid('Nhãn không hợp lệ (tối đa 10 nhãn, mỗi nhãn tối đa 30 ký tự).');
    }
    value.labels = [...new Set(labels.map((label) => label.trim()))];
  }
  if ('order' in body) {
    const order = body['order'];
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      return invalid('Thứ tự không hợp lệ.');
    }
    value.order = order;
  }
  if ('startDate' in body) {
    if (!isValidIsoDate(body['startDate'])) {
      return invalid('Ngày bắt đầu không hợp lệ.');
    }
    value.startDate = body['startDate'];
  }
  if ('wbsId' in body) {
    const wbsId = body['wbsId'];
    if (wbsId !== null && typeof wbsId !== 'string') {
      return invalid('Hạng mục WBS không hợp lệ.');
    }
    value.wbsId = wbsId;
  }
  if ('dependencyIds' in body) {
    const ids = body['dependencyIds'];
    if (!Array.isArray(ids) || ids.length > 20 || !ids.every((id): id is string => typeof id === 'string')) {
      return invalid('Danh sách phụ thuộc không hợp lệ.');
    }
    value.dependencyIds = [...new Set(ids)];
  }
  if ('isMilestone' in body) {
    if (typeof body['isMilestone'] !== 'boolean') {
      return invalid('Cờ mốc tiến độ không hợp lệ.');
    }
    value.isMilestone = body['isMilestone'];
  }
  return { ok: true, value };
}

type ScheduleFields = Pick<TaskRecord, 'startDate' | 'dueDate' | 'wbsId' | 'dependencyIds' | 'isMilestone'>;

function formatVnDate(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** true nếu `targetId` nằm trong chuỗi công việc phải làm trước của `fromId` (=> thêm phụ thuộc sẽ tạo vòng). */
function dependsOn(fromId: string, targetId: string, visited = new Set<string>()): boolean {
  if (fromId === targetId) {
    return true;
  }
  if (visited.has(fromId)) {
    return false;
  }
  visited.add(fromId);
  const task = db.tasks.findById(fromId);
  return (task?.dependencyIds ?? []).some((id) => dependsOn(id, targetId, visited));
}

/**
 * Kiểm tra lịch: bắt đầu ≤ kết thúc, WBS cùng dự án, phụ thuộc cùng dự án, không vòng lặp
 * và không bắt đầu trước khi công việc phải làm trước hoàn thành (FS).
 */
function validateSchedule(projectId: string, taskId: string | null, fields: ScheduleFields): Success<ScheduleFields> | Failure {
  const normalized = fields.isMilestone ? { ...fields, dueDate: fields.startDate } : fields;
  if (normalized.startDate > normalized.dueDate) {
    return invalid('Ngày bắt đầu phải trước hoặc bằng hạn hoàn thành.');
  }
  if (normalized.wbsId) {
    const node = db.wbs.findById(normalized.wbsId);
    if (!node || node.projectId !== projectId) {
      return invalid('Hạng mục WBS không thuộc dự án.');
    }
  }
  for (const dependencyId of normalized.dependencyIds) {
    const predecessor = db.tasks.findById(dependencyId);
    if (!predecessor || predecessor.projectId !== projectId) {
      return invalid('Công việc phụ thuộc phải cùng dự án.');
    }
    if (taskId && dependsOn(dependencyId, taskId)) {
      return { ok: false, response: errorResponse(409, 'DEPENDENCY_CYCLE', `Phụ thuộc vào "${predecessor.title}" sẽ tạo vòng lặp.`) };
    }
    if (normalized.startDate < predecessor.dueDate) {
      return {
        ok: false,
        response: errorResponse(
          422,
          'DEPENDENCY_VIOLATION',
          `Không thể bắt đầu trước khi "${predecessor.title}" hoàn thành (${formatVnDate(predecessor.dueDate)}).`,
        ),
      };
    }
  }
  return { ok: true, value: normalized };
}

/** Dời các công việc phía sau (giữ nguyên thời lượng) khi công việc trước kết thúc muộn hơn. */
function cascadeSuccessors(taskId: string, now: string): void {
  const queue = [taskId];
  while (queue.length) {
    const current = db.tasks.findById(queue.shift() ?? '');
    if (!current) {
      continue;
    }
    for (const successor of db.tasks.filter((task) => task.dependencyIds.includes(current.id))) {
      if (successor.startDate >= current.dueDate) {
        continue;
      }
      const shift = differenceInCalendarDays(parseIsoDate(current.dueDate), parseIsoDate(successor.startDate));
      db.tasks.update(successor.id, {
        startDate: current.dueDate,
        dueDate: toIsoDate(addDays(parseIsoDate(successor.dueDate), shift)),
        updatedAt: now,
      });
      queue.push(successor.id);
    }
  }
}

/** Kiểm tra quyền ghi: đúng role và (với kỹ sư) phải được gán vào dự án. */
function authorizeWrite(user: UserRecord, projectId: string, roles: readonly UserRole[]): Failure | null {
  const project = db.projects.findById(projectId);
  if (!project) {
    return { ok: false, response: errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.') };
  }
  if (!roles.includes(user.role) || !canViewProject(user, project)) {
    return { ok: false, response: errorResponse(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.') };
  }
  return null;
}

function nextOrder(status: TaskStatus, excludeId?: string): number {
  const orders = db.tasks.filter((task) => task.status === status && task.id !== excludeId).map((task) => task.order);
  return (orders.length ? Math.max(...orders) : 0) + 1000;
}

/** Quy tắc nghiệp vụ: hoàn thành = 100%; kéo ra khỏi "Hoàn thành" mà không nêu % thì về 90%. */
function applyStatusRules(current: TaskRecord | null, changes: TaskUpdateRequest): TaskUpdateRequest {
  if (changes.status === 'DONE') {
    return { ...changes, percentComplete: 100 };
  }
  if (current?.status === 'DONE' && changes.status && changes.percentComplete === undefined) {
    return { ...changes, percentComplete: 90 };
  }
  return changes;
}

function findViewableTask(user: UserRecord, id: string): Success<TaskRecord> | Failure {
  const task = db.tasks.findById(id);
  if (!task) {
    return { ok: false, response: errorResponse(404, 'NOT_FOUND', 'Không tìm thấy công việc.') };
  }
  const project = db.projects.findById(task.projectId);
  if (!project || !canViewProject(user, project)) {
    return { ok: false, response: errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào dự án của công việc này.') };
  }
  return { ok: true, value: task };
}

export const tasksHandlers = [
  http.get(apiUrl('/tasks'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const visibleIds = new Set(
      db.projects.filter((project) => canViewProject(auth.user, project)).map((project) => project.id),
    );
    const tasks = db.tasks.filter((task) => visibleIds.has(task.projectId)).map(toTaskDto);
    const query = parseListQuery(new URL(request.url), { maxPageSize: MAX_TASK_PAGE_SIZE });
    return HttpResponse.json(applyListQuery(tasks, query, SEARCH_FIELDS));
  }),

  http.get(apiUrl('/tasks/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const result = findViewableTask(auth.user, String(params['id']));
    return result.ok ? HttpResponse.json(toTaskDto(result.value)) : result.response;
  }),

  http.post(apiUrl('/tasks'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editTasks);
    if (!auth.ok) {
      return auth.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body['projectId'] !== 'string') {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng chọn dự án.');
    }
    if (!('title' in body) || !('dueDate' in body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tiêu đề và hạn hoàn thành là bắt buộc.');
    }
    const denied = authorizeWrite(auth.user, body['projectId'], PERMISSIONS.editTasks);
    if (denied) {
      return denied.response;
    }
    const result = validateTaskFields(body);
    if (!result.ok) {
      return result.response;
    }
    const fields = applyStatusRules(null, result.value);
    const status = fields.status ?? 'TODO';
    const dueDate = fields.dueDate ?? '';
    const schedule = validateSchedule(body['projectId'], null, {
      startDate: fields.startDate ?? dueDate,
      dueDate,
      wbsId: fields.wbsId ?? null,
      dependencyIds: fields.dependencyIds ?? [],
      isMilestone: fields.isMilestone ?? false,
    });
    if (!schedule.ok) {
      return schedule.response;
    }
    const now = new Date().toISOString();
    const defaults: Omit<TaskCreateRequest, 'projectId' | 'title' | 'dueDate' | 'startDate'> = {
      description: '',
      status,
      priority: 'MEDIUM',
      assigneeId: null,
      percentComplete: 0,
      labels: [],
    };
    const record = db.tasks.insert({
      ...defaults,
      ...fields,
      ...schedule.value,
      id: newId('tsk'),
      projectId: body['projectId'],
      title: fields.title ?? '',
      status,
      order: fields.order ?? nextOrder(status),
      createdAt: now,
      updatedAt: now,
    });
    return HttpResponse.json(toTaskDto(record), { status: 201 });
  }),

  http.patch(apiUrl('/tasks/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editTasks);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findViewableTask(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ.');
    }
    const result = validateTaskFields(body);
    if (!result.ok) {
      return result.response;
    }
    const current = found.value;
    const changes = applyStatusRules(current, result.value);
    const scheduleChanged = ['startDate', 'dueDate', 'wbsId', 'dependencyIds', 'isMilestone'].some((key) => key in changes);
    let schedule: ScheduleFields | null = null;
    if (scheduleChanged) {
      const checked = validateSchedule(current.projectId, current.id, {
        startDate: changes.startDate ?? current.startDate,
        dueDate: changes.dueDate ?? current.dueDate,
        wbsId: changes.wbsId !== undefined ? changes.wbsId : current.wbsId,
        dependencyIds: changes.dependencyIds ?? current.dependencyIds,
        isMilestone: changes.isMilestone ?? current.isMilestone,
      });
      if (!checked.ok) {
        return checked.response;
      }
      schedule = checked.value;
    }
    const movedColumn = changes.status !== undefined && changes.status !== current.status;
    const now = new Date().toISOString();
    const updated = db.tasks.update(current.id, {
      ...changes,
      ...(schedule ?? {}),
      order: changes.order ?? (movedColumn && changes.status ? nextOrder(changes.status, current.id) : current.order),
      updatedAt: now,
    });
    if (schedule) {
      cascadeSuccessors(current.id, now);
    }
    return updated ? HttpResponse.json(toTaskDto(updated)) : errorResponse(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
  }),

  http.delete(apiUrl('/tasks/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.deleteTasks);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findViewableTask(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    db.tasks.remove(found.value.id);
    // Gỡ liên kết phụ thuộc trỏ tới công việc đã xoá.
    for (const successor of db.tasks.filter((task) => task.dependencyIds.includes(found.value.id))) {
      db.tasks.update(successor.id, { dependencyIds: successor.dependencyIds.filter((id) => id !== found.value.id) });
    }
    db.taskComments.removeWhere((comment) => comment.taskId === found.value.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(apiUrl('/tasks/:id/comments'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findViewableTask(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const comments = db.taskComments
      .filter((comment) => comment.taskId === found.value.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toCommentDto);
    return HttpResponse.json(comments);
  }),

  http.post(apiUrl('/tasks/:id/comments'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.commentTasks);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findViewableTask(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const body = await readJsonBody(request);
    const content = isRecord(body) && typeof body['content'] === 'string' ? body['content'].trim() : '';
    if (!content || content.length > 2000) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Nội dung bình luận là bắt buộc (tối đa 2000 ký tự).');
    }
    const record = db.taskComments.insert({
      id: newId('cmt'),
      taskId: found.value.id,
      authorId: auth.user.id,
      content,
      createdAt: new Date().toISOString(),
    });
    return HttpResponse.json(toCommentDto(record), { status: 201 });
  }),
];
