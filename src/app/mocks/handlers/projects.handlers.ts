import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import { Project, PROJECT_STATUSES, ProjectStatus, ProjectUpsertRequest } from '../../features/projects/models/project.model';
import { ApiError } from '../../shared/models/api.model';
import { isValidIsoDate } from '../../shared/utils/date.utils';
import { db } from '../db';
import { ProjectRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { canViewProject, groupTasksByProject, newId, toProjectDto, toUserSummary, visibleProjects } from '../utils/serializers';

const SEARCH_FIELDS: readonly (keyof Project & string)[] = ['code', 'name', 'clientName'];
const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

type ValidationResult =
  | { readonly ok: true; readonly value: ProjectUpsertRequest }
  | { readonly ok: false; readonly response: HttpResponse<ApiError> };

function invalid(message: string): ValidationResult {
  return { ok: false, response: errorResponse(422, 'VALIDATION_ERROR', message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

/** Kiểm tra body tạo/sửa dự án giống một BE thật: trả 422 kèm thông báo tiếng Việt. */
function validateProject(body: unknown, currentId: string | null): ValidationResult {
  if (!isRecord(body)) {
    return invalid('Dữ liệu gửi lên không hợp lệ.');
  }
  const { code, name, description, clientName, location, startDate, endDate, budget, status, managerId, memberIds } =
    body;

  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
    return invalid('Mã dự án gồm 3–20 ký tự chữ in hoa, số hoặc dấu gạch ngang.');
  }
  if (!isNonEmptyString(name, 200)) {
    return invalid('Tên dự án là bắt buộc (tối đa 200 ký tự).');
  }
  if (!isNonEmptyString(clientName, 200)) {
    return invalid('Chủ đầu tư là bắt buộc.');
  }
  if (
    !isRecord(location) ||
    !isNonEmptyString(location['address'], 300) ||
    !isNonEmptyString(location['province'], 100) ||
    typeof location['lat'] !== 'number' ||
    typeof location['lng'] !== 'number' ||
    Math.abs(location['lat']) > 90 ||
    Math.abs(location['lng']) > 180
  ) {
    return invalid('Địa điểm công trình không hợp lệ.');
  }
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return invalid('Ngày bắt đầu/kết thúc không hợp lệ.');
  }
  if (endDate < startDate) {
    return invalid('Ngày kết thúc phải sau ngày bắt đầu.');
  }
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) {
    return invalid('Ngân sách phải lớn hơn 0.');
  }
  if (typeof status !== 'string' || !(PROJECT_STATUSES as readonly string[]).includes(status)) {
    return invalid('Trạng thái dự án không hợp lệ.');
  }
  const manager = typeof managerId === 'string' ? db.users.findById(managerId) : undefined;
  if (managerId !== null && managerId !== undefined && (!manager || manager.role === 'CLIENT')) {
    return invalid('Quản lý dự án không hợp lệ.');
  }
  const members = Array.isArray(memberIds) ? memberIds : [];
  if (!members.every((id): id is string => typeof id === 'string' && db.users.findById(id) !== undefined)) {
    return invalid('Danh sách kỹ sư phụ trách không hợp lệ.');
  }
  if (db.projects.findOne((project) => project.code === code && project.id !== currentId)) {
    return { ok: false, response: errorResponse(409, 'PROJECT_CODE_EXISTS', `Mã dự án "${code}" đã tồn tại.`) };
  }

  return {
    ok: true,
    value: {
      code,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
      clientName: clientName.trim(),
      location: {
        address: String(location['address']).trim(),
        province: String(location['province']).trim(),
        lat: location['lat'],
        lng: location['lng'],
      },
      startDate,
      endDate,
      budget: Math.round(budget),
      status: status as ProjectStatus,
      managerId: manager ? manager.id : null,
      memberIds: [...new Set(members)],
    },
  };
}

function projectDto(record: ProjectRecord): Project {
  return toProjectDto(record, db.tasks.filter((task) => task.projectId === record.id));
}

export const projectsHandlers = [
  http.get(apiUrl('/projects'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const tasksByProject = groupTasksByProject(db.tasks.all());
    const projects = visibleProjects(auth.user).map((record) =>
      toProjectDto(record, tasksByProject.get(record.id) ?? []),
    );
    return HttpResponse.json(applyListQuery(projects, parseListQuery(new URL(request.url)), SEARCH_FIELDS));
  }),

  http.get(apiUrl('/projects/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const project = db.projects.findById(String(params['id']));
    if (!project) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
    }
    if (!canViewProject(auth.user, project)) {
      return errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào dự án này.');
    }
    return HttpResponse.json(projectDto(project));
  }),

  http.get(apiUrl('/projects/:id/members'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const project = db.projects.findById(String(params['id']));
    if (!project) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
    }
    if (!canViewProject(auth.user, project)) {
      return errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào dự án này.');
    }
    const ids = [...new Set([project.managerId, ...project.memberIds].filter((id): id is string => id !== null))];
    const members = ids.flatMap((id) => {
      const user = db.users.findById(id);
      return user ? [toUserSummary(user)] : [];
    });
    return HttpResponse.json(members);
  }),

  http.post(apiUrl('/projects'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageProjects);
    if (!auth.ok) {
      return auth.response;
    }
    const result = validateProject(await readJsonBody(request), null);
    if (!result.ok) {
      return result.response;
    }
    const now = new Date().toISOString();
    const record = db.projects.insert({
      ...result.value,
      id: newId('prj'),
      actualCost: 0,
      createdAt: now,
      updatedAt: now,
    });
    return HttpResponse.json(projectDto(record), { status: 201 });
  }),

  http.put(apiUrl('/projects/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageProjects);
    if (!auth.ok) {
      return auth.response;
    }
    const id = String(params['id']);
    if (!db.projects.findById(id)) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
    }
    const result = validateProject(await readJsonBody(request), id);
    if (!result.ok) {
      return result.response;
    }
    const updated = db.projects.update(id, { ...result.value, updatedAt: new Date().toISOString() });
    return updated ? HttpResponse.json(projectDto(updated)) : errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
  }),

  http.delete(apiUrl('/projects/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageProjects);
    if (!auth.ok) {
      return auth.response;
    }
    const id = String(params['id']);
    if (!db.projects.remove(id)) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
    }
    // Xoá dây chuyền: công việc và bình luận của dự án.
    const taskIds = new Set(db.tasks.filter((task) => task.projectId === id).map((task) => task.id));
    db.tasks.removeWhere((task) => taskIds.has(task.id));
    db.taskComments.removeWhere((comment) => taskIds.has(comment.taskId));
    db.siteDiaries.removeWhere((diary) => diary.projectId === id);
    db.wbs.removeWhere((node) => node.projectId === id);
    db.stock.removeWhere((record) => record.projectId === id);
    db.stockTransactions.removeWhere((record) => record.projectId === id);
    db.materialRequests.removeWhere((record) => record.projectId === id);
    db.contracts.removeWhere((record) => record.projectId === id);
    db.costItems.removeWhere((record) => record.projectId === id);
    db.costEntries.removeWhere((record) => record.projectId === id);
    db.changeOrders.removeWhere((record) => record.projectId === id);
    db.payments.removeWhere((record) => record.projectId === id);
    return new HttpResponse(null, { status: 204 });
  }),
];
