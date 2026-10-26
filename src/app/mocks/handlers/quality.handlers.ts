import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  CHECK_RESULTS,
  ChecklistItem,
  EDITABLE_INSPECTION_STATUSES,
  Inspection,
  INSPECTION_APPROVAL_LEVELS,
  InspectionStats,
  PUNCH_SEVERITIES,
  PunchItem,
  PunchSeverity,
  PunchTransition,
  QualityProjectRef,
} from '../../features/quality/models/quality.model';
import { ApiError } from '../../shared/models/api.model';
import { Photo } from '../../shared/models/photo.model';
import { UserSummary } from '../../shared/models/user.model';
import { isValidIsoDate, todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { CHECKLIST_TEMPLATES } from '../factories/quality.factory';
import { InspectionRecord, ProjectRecord, PunchRecord, UserRecord } from '../models/mock-records';
import { withWbsCodes } from './wbs.handlers';
import { notificationHub, projectManagerId, userIdsWithRole } from '../realtime/notification-hub';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { canViewProject, newId, toUserSummary } from '../utils/serializers';
import { isOneOf, isRecord, isText, parseList, parsePhoto } from '../utils/validation';

const UNKNOWN_USER: UserSummary = { id: '', fullName: 'Người dùng đã xoá', jobTitle: '', role: 'CLIENT' };
const MAX_PHOTOS = 10;
const MAX_ITEMS = 40;

type Failure = { readonly ok: false; readonly response: HttpResponse<ApiError> };
type Success<T> = { readonly ok: true; readonly value: T };

function fail(status: 403 | 404 | 409 | 422, code: string, message: string): Failure {
  return { ok: false, response: errorResponse(status, code, message) };
}

function userSummary(id: string | null): UserSummary | null {
  const user = id ? db.users.findById(id) : undefined;
  return user ? toUserSummary(user) : null;
}

function projectRef(projectId: string): QualityProjectRef {
  const project = db.projects.findById(projectId);
  return project
    ? { id: project.id, code: project.code, name: project.name, lat: project.location.lat, lng: project.location.lng }
    : { id: projectId, code: '—', name: 'Dự án đã xoá', lat: 0, lng: 0 };
}

function wbsName(record: InspectionRecord): string {
  const node = withWbsCodes(db.wbs.filter((item) => item.projectId === record.projectId)).find((item) => item.id === record.wbsId);
  return node ? `${node.code} · ${node.name}` : 'Hạng mục đã xoá';
}

function isOpenPunch(record: PunchRecord): boolean {
  return record.status !== 'VERIFIED';
}

function inspectionStats(record: InspectionRecord): InspectionStats {
  const count = (result: ChecklistItem['result']): number => record.items.filter((item) => item.result === result).length;
  return {
    total: record.items.length,
    pass: count('PASS'),
    fail: count('FAIL'),
    na: count('NA'),
    pending: count(null),
    openPunchItems: db.punchItems.filter((punch) => punch.inspectionId === record.id && isOpenPunch(punch)).length,
  };
}

export function toInspectionDto(record: InspectionRecord): Inspection {
  const { createdById, approvals, history, ...rest } = record;
  return {
    ...rest,
    project: projectRef(record.projectId),
    wbsName: wbsName(record),
    approvals: approvals.map((approval) => ({
      level: approval.level,
      label: INSPECTION_APPROVAL_LEVELS.find((config) => config.level === approval.level)?.label ?? `Cấp ${approval.level}`,
      decision: approval.decision,
      by: userSummary(approval.byId),
      at: approval.at,
      note: approval.note,
    })),
    history: history.map((entry) => ({
      action: entry.action,
      level: entry.level,
      by: userSummary(entry.byId) ?? UNKNOWN_USER,
      at: entry.at,
      note: entry.note,
    })),
    createdBy: userSummary(createdById) ?? UNKNOWN_USER,
    stats: inspectionStats(record),
  };
}

export function toPunchDto(record: PunchRecord): PunchItem {
  const { assigneeId, createdById, history, ...rest } = record;
  return {
    ...rest,
    project: projectRef(record.projectId),
    inspectionCode: record.inspectionId ? (db.inspections.findById(record.inspectionId)?.code ?? null) : null,
    assignee: userSummary(assigneeId),
    isOverdue: isOpenPunch(record) && record.status !== 'RESOLVED' && record.dueDate < todayIso(),
    history: history.map((entry) => ({ action: entry.action, by: userSummary(entry.byId) ?? UNKNOWN_USER, at: entry.at, note: entry.note })),
    createdBy: userSummary(createdById) ?? UNKNOWN_USER,
  };
}

/** CLIENT chỉ xem phiếu đã nghiệm thu xong; kỹ sư chỉ xem dự án được gán. */
function canViewInspection(user: UserRecord, record: InspectionRecord): boolean {
  const project = db.projects.findById(record.projectId);
  return !!project && canViewProject(user, project) && (user.role !== 'CLIENT' || record.status === 'APPROVED');
}

function canViewPunch(user: UserRecord, record: PunchRecord): boolean {
  const project = db.projects.findById(record.projectId);
  return !!project && canViewProject(user, project);
}

function findProject(user: UserRecord, id: unknown): Success<ProjectRecord> | Failure {
  const project = typeof id === 'string' ? db.projects.findById(id) : undefined;
  if (!project) {
    return fail(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
  }
  return canViewProject(user, project) ? { ok: true, value: project } : fail(403, 'FORBIDDEN', 'Bạn không được gán vào dự án này.');
}

function findInspection(user: UserRecord, id: string): Success<InspectionRecord> | Failure {
  const record = db.inspections.findById(id);
  if (!record) {
    return fail(404, 'NOT_FOUND', 'Không tìm thấy phiếu nghiệm thu.');
  }
  return canViewInspection(user, record) ? { ok: true, value: record } : fail(403, 'FORBIDDEN', 'Bạn không có quyền xem phiếu này.');
}

function findPunch(user: UserRecord, id: string): Success<PunchRecord> | Failure {
  const record = db.punchItems.findById(id);
  if (!record) {
    return fail(404, 'NOT_FOUND', 'Không tìm thấy lỗi cần xử lý.');
  }
  return canViewPunch(user, record) ? { ok: true, value: record } : fail(403, 'FORBIDDEN', 'Bạn không có quyền xem mục này.');
}

/** Người có thể nhận việc: quản lý và thành viên của dự án. */
function isProjectMember(project: ProjectRecord, userId: string): boolean {
  return project.managerId === userId || project.memberIds.includes(userId);
}

function nextCode(prefix: string, codes: readonly string[]): string {
  const max = codes.reduce((current, code) => Math.max(current, Number(code.split('-')[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function readNote(body: unknown): string {
  return isRecord(body) && typeof body['note'] === 'string' ? body['note'].trim().slice(0, 1000) : '';
}

function parseChecklist(value: unknown, existing: readonly ChecklistItem[]): ChecklistItem[] | null {
  const items = parseList(value, MAX_ITEMS, (item) => {
    const result = item['result'];
    if (!isText(item['criterion'], 1, 300) || (result !== null && !isOneOf(CHECK_RESULTS, result))) {
      return null;
    }
    const id = typeof item['id'] === 'string' && existing.some((current) => current.id === item['id']) ? item['id'] : newId('chk');
    return {
      id,
      criterion: item['criterion'].trim(),
      requirement: typeof item['requirement'] === 'string' ? item['requirement'].trim().slice(0, 300) : '',
      result,
      note: typeof item['note'] === 'string' ? item['note'].trim().slice(0, 500) : '',
    };
  });
  return items && items.length > 0 ? items : null;
}

function emptyApprovals(): InspectionRecord['approvals'] {
  return INSPECTION_APPROVAL_LEVELS.map(({ level }) => ({ level, decision: null, byId: null, at: null, note: '' }));
}

function formatDate(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** Người nhận "chờ duyệt": cấp có role PROJECT_MANAGER do quản lý dự án duyệt, cấp khác gửi theo role. */
function approversOf(projectId: string, level: number): string[] {
  const roles = INSPECTION_APPROVAL_LEVELS.find((config) => config.level === level)?.roles ?? [];
  return roles.includes('PROJECT_MANAGER')
    ? [projectManagerId(projectId)].filter((id): id is string => id !== null)
    : roles.flatMap((role) => userIdsWithRole(role));
}

function notifyPunch(record: PunchRecord, userIds: readonly (string | null)[], title: string, message: string, actorId: string): void {
  notificationHub.notify(userIds, { type: 'PUNCH', title, message, link: `/quality/punch/${record.id}`, projectId: record.projectId }, actorId);
}

export const qualityHandlers = [
  http.get(apiUrl('/quality/templates'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    return auth.ok ? HttpResponse.json(CHECKLIST_TEMPLATES) : auth.response;
  }),

  // -------------------------------------------------------------------------
  // Phiếu nghiệm thu
  // -------------------------------------------------------------------------

  http.get(apiUrl('/inspections'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const url = new URL(request.url);
    const awaitingMe = url.searchParams.get('awaitingMe') === 'true';
    url.searchParams.delete('awaitingMe');
    const query = parseListQuery(url, { maxPageSize: 200 });
    const role = auth.user.role;
    const records = db.inspections
      .filter((record) => canViewInspection(auth.user, record))
      .filter(
        (record) =>
          !awaitingMe ||
          (record.status === 'IN_REVIEW' &&
            record.createdById !== auth.user.id &&
            !!INSPECTION_APPROVAL_LEVELS.find((config) => config.level === record.currentLevel)?.roles.includes(role)),
      )
      .map(toInspectionDto);
    return HttpResponse.json(
      applyListQuery(records, { ...query, sort: query.sort ?? { field: 'inspectionDate', direction: 'desc' } }, ['title', 'code', 'location']),
    );
  }),

  http.get(apiUrl('/inspections/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findInspection(auth.user, String(params['id']));
    return found.ok ? HttpResponse.json(toInspectionDto(found.value)) : found.response;
  }),

  http.post(apiUrl('/inspections'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editQuality);
    if (!auth.ok) {
      return auth.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const project = findProject(auth.user, body['projectId']);
    if (!project.ok) {
      return project.response;
    }
    const node = typeof body['wbsId'] === 'string' ? db.wbs.findById(body['wbsId']) : undefined;
    if (!node || node.projectId !== project.value.id) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Hạng mục không thuộc dự án.');
    }
    const template = CHECKLIST_TEMPLATES.find((item) => item.id === body['templateId']);
    if (!template) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng chọn mẫu checklist.');
    }
    if (!isText(body['title'], 1, 200)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tên phiếu nghiệm thu là bắt buộc (tối đa 200 ký tự).');
    }
    if (!isValidIsoDate(body['inspectionDate'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Ngày nghiệm thu không hợp lệ.');
    }
    const now = new Date().toISOString();
    const id = newId('ins');
    const record = db.inspections.insert({
      id,
      code: nextCode('NT', db.inspections.filter((item) => item.projectId === project.value.id).map((item) => item.code)),
      projectId: project.value.id,
      wbsId: node.id,
      templateId: template.id,
      title: body['title'].trim(),
      location: typeof body['location'] === 'string' ? body['location'].trim().slice(0, 200) : '',
      inspectionDate: body['inspectionDate'],
      items: template.items.map((item, index) => ({ id: `${id}-c${index + 1}`, ...item, result: null, note: '' })),
      status: 'DRAFT',
      currentLevel: null,
      approvals: emptyApprovals(),
      history: [{ action: 'CREATED', level: null, byId: auth.user.id, at: now, note: '' }],
      createdById: auth.user.id,
      createdAt: now,
      updatedAt: now,
    });
    return HttpResponse.json(toInspectionDto(record), { status: 201 });
  }),

  http.put(apiUrl('/inspections/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editQuality);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findInspection(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const record = found.value;
    if (!EDITABLE_INSPECTION_STATUSES.includes(record.status)) {
      return errorResponse(409, 'INSPECTION_LOCKED', 'Phiếu đang duyệt hoặc đã nghiệm thu, không thể sửa.');
    }
    const body = await readJsonBody(request);
    if (!isRecord(body) || !isText(body['title'], 1, 200) || !isValidIsoDate(body['inspectionDate'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tên phiếu và ngày nghiệm thu là bắt buộc.');
    }
    const items = parseChecklist(body['items'], record.items);
    if (!items) {
      return errorResponse(422, 'VALIDATION_ERROR', `Checklist phải có 1–${MAX_ITEMS} tiêu chí hợp lệ.`);
    }
    const updated = db.inspections.update(record.id, {
      title: body['title'].trim(),
      location: typeof body['location'] === 'string' ? body['location'].trim().slice(0, 200) : record.location,
      inspectionDate: body['inspectionDate'],
      items,
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json(toInspectionDto(updated ?? record));
  }),

  http.delete(apiUrl('/inspections/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editQuality);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findInspection(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    if (found.value.status !== 'DRAFT') {
      return errorResponse(409, 'INSPECTION_LOCKED', 'Chỉ xoá được phiếu ở trạng thái bản nháp.');
    }
    db.inspections.remove(found.value.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(apiUrl('/inspections/:id/submit'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editQuality);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findInspection(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const record = found.value;
    if (!EDITABLE_INSPECTION_STATUSES.includes(record.status)) {
      return errorResponse(409, 'INVALID_STATUS', 'Chỉ gửi duyệt được bản nháp hoặc phiếu bị trả lại.');
    }
    const pending = record.items.filter((item) => item.result === null).length;
    if (pending > 0) {
      return errorResponse(422, 'CHECKLIST_INCOMPLETE', `Còn ${pending} tiêu chí chưa đánh giá.`);
    }
    const now = new Date().toISOString();
    // Gửi lại sau khi bị trả lại: bắt đầu lại từ cấp 1.
    const updated = db.inspections.update(record.id, {
      status: 'IN_REVIEW',
      currentLevel: INSPECTION_APPROVAL_LEVELS[0].level,
      approvals: emptyApprovals(),
      history: [...record.history, { action: 'SUBMITTED', level: null, byId: auth.user.id, at: now, note: '' }],
      updatedAt: now,
    });
    const firstLevel = INSPECTION_APPROVAL_LEVELS[0].level;
    notificationHub.notify(
      approversOf(record.projectId, firstLevel),
      {
        type: 'QUALITY',
        title: `Phiếu ${record.code} chờ duyệt cấp ${firstLevel}`,
        message: record.title,
        link: `/quality/inspections/${record.id}`,
        projectId: record.projectId,
      },
      auth.user.id,
    );
    return HttpResponse.json(toInspectionDto(updated ?? record));
  }),

  http.post(apiUrl('/inspections/:id/:decision'), async ({ request, params }) => {
    const decision = String(params['decision']);
    if (decision !== 'approve' && decision !== 'reject') {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy thao tác.');
    }
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findInspection(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const record = found.value;
    const level = INSPECTION_APPROVAL_LEVELS.find((config) => config.level === record.currentLevel);
    if (record.status !== 'IN_REVIEW' || !level) {
      return errorResponse(409, 'INVALID_STATUS', 'Phiếu không ở trạng thái chờ duyệt.');
    }
    if (!level.roles.includes(auth.user.role)) {
      return errorResponse(403, 'FORBIDDEN', `Cấp đang chờ duyệt: ${level.label}. Bạn không có quyền duyệt cấp này.`);
    }
    if (record.createdById === auth.user.id) {
      return errorResponse(403, 'SELF_APPROVAL', 'Không được tự duyệt phiếu do mình lập.');
    }
    if (record.approvals.some((approval) => approval.byId === auth.user.id)) {
      return errorResponse(403, 'ALREADY_APPROVED', 'Bạn đã duyệt ở cấp trước; cấp này cần người khác duyệt.');
    }
    const note = readNote(await readJsonBody(request));
    const stats = inspectionStats(record);
    if (decision === 'approve' && stats.fail > 0) {
      return errorResponse(409, 'HAS_FAILED_ITEMS', 'Còn tiêu chí không đạt. Hãy trả lại để khắc phục rồi nghiệm thu lại.');
    }
    if (decision === 'approve' && stats.openPunchItems > 0) {
      return errorResponse(409, 'OPEN_PUNCH_ITEMS', `Còn ${stats.openPunchItems} lỗi trong punch list chưa được xác nhận đóng.`);
    }
    if (decision === 'reject' && !note) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do trả lại.');
    }

    const now = new Date().toISOString();
    const approvals = record.approvals.map((approval) =>
      approval.level === level.level
        ? { ...approval, decision: decision === 'approve' ? ('APPROVED' as const) : ('REJECTED' as const), byId: auth.user.id, at: now, note }
        : approval,
    );
    const nextLevel = INSPECTION_APPROVAL_LEVELS.find((config) => config.level > level.level);
    const status = decision === 'reject' ? 'REJECTED' : nextLevel ? 'IN_REVIEW' : 'APPROVED';
    const updated = db.inspections.update(record.id, {
      status,
      currentLevel: status === 'IN_REVIEW' ? (nextLevel?.level ?? null) : null,
      approvals,
      history: [
        ...record.history,
        { action: decision === 'approve' ? 'APPROVED' : 'REJECTED', level: level.level, byId: auth.user.id, at: now, note },
      ],
      updatedAt: now,
    });
    const link = `/quality/inspections/${record.id}`;
    if (status === 'IN_REVIEW' && nextLevel) {
      notificationHub.notify(
        approversOf(record.projectId, nextLevel.level),
        {
          type: 'QUALITY',
          title: `Phiếu ${record.code} chờ duyệt cấp ${nextLevel.level}`,
          message: `${record.title} – đã qua cấp ${level.level}.`,
          link,
          projectId: record.projectId,
        },
        auth.user.id,
      );
    } else {
      notificationHub.notify(
        [record.createdById],
        {
          type: 'QUALITY',
          title: status === 'APPROVED' ? `Phiếu ${record.code} đã nghiệm thu` : `Phiếu ${record.code} bị trả lại ở cấp ${level.level}`,
          message: note ? `${auth.user.fullName}: “${note}”` : record.title,
          link,
          projectId: record.projectId,
        },
        auth.user.id,
      );
    }
    return HttpResponse.json(toInspectionDto(updated ?? record));
  }),

  // -------------------------------------------------------------------------
  // Punch list
  // -------------------------------------------------------------------------

  http.get(apiUrl('/punch-items'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const url = new URL(request.url);
    const overdue = url.searchParams.get('overdue') === 'true';
    url.searchParams.delete('overdue');
    if (url.searchParams.get('assigneeId') === 'me') {
      url.searchParams.set('assigneeId', auth.user.id);
    }
    const assigneeId = url.searchParams.get('assigneeId');
    url.searchParams.delete('assigneeId');
    const query = parseListQuery(url, { maxPageSize: 200 });
    const items = db.punchItems
      .filter((record) => canViewPunch(auth.user, record))
      .filter((record) => !assigneeId || record.assigneeId === assigneeId)
      .map(toPunchDto)
      .filter((item) => !overdue || item.isOverdue);
    return HttpResponse.json(
      applyListQuery(items, { ...query, sort: query.sort ?? { field: 'createdAt', direction: 'desc' } }, ['title', 'code', 'location', 'description']),
    );
  }),

  http.get(apiUrl('/punch-items/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findPunch(auth.user, String(params['id']));
    return found.ok ? HttpResponse.json(toPunchDto(found.value)) : found.response;
  }),

  http.post(apiUrl('/punch-items'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editQuality);
    if (!auth.ok) {
      return auth.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const project = findProject(auth.user, body['projectId']);
    if (!project.ok) {
      return project.response;
    }
    if (!isText(body['title'], 1, 200)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tiêu đề lỗi là bắt buộc (tối đa 200 ký tự).');
    }
    if (!isOneOf<PunchSeverity>(PUNCH_SEVERITIES, body['severity'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Mức độ không hợp lệ.');
    }
    if (typeof body['assigneeId'] !== 'string' || !isProjectMember(project.value, body['assigneeId'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Người xử lý phải là thành viên dự án.');
    }
    if (!isValidIsoDate(body['dueDate']) || body['dueDate'] < todayIso()) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Hạn xử lý không hợp lệ (không được ở quá khứ).');
    }
    const beforePhotos = parseList(body['beforePhotos'] ?? [], MAX_PHOTOS, parsePhoto);
    if (!beforePhotos || beforePhotos.length === 0) {
      return errorResponse(422, 'VALIDATION_ERROR', `Cần 1–${MAX_PHOTOS} ảnh hiện trạng lỗi.`);
    }
    let inspectionId: string | null = null;
    let checklistItemId: string | null = null;
    if (typeof body['inspectionId'] === 'string') {
      const inspection = db.inspections.findById(body['inspectionId']);
      if (!inspection || inspection.projectId !== project.value.id) {
        return errorResponse(422, 'VALIDATION_ERROR', 'Phiếu nghiệm thu không thuộc dự án.');
      }
      inspectionId = inspection.id;
      const itemId = body['checklistItemId'];
      checklistItemId = typeof itemId === 'string' && inspection.items.some((item) => item.id === itemId) ? itemId : null;
    }
    const now = new Date().toISOString();
    const record = db.punchItems.insert({
      id: newId('pun'),
      code: nextCode('PL', db.punchItems.filter((item) => item.projectId === project.value.id).map((item) => item.code)),
      projectId: project.value.id,
      inspectionId,
      checklistItemId,
      title: body['title'].trim(),
      description: typeof body['description'] === 'string' ? body['description'].trim().slice(0, 2000) : '',
      location: typeof body['location'] === 'string' ? body['location'].trim().slice(0, 200) : '',
      severity: body['severity'],
      status: 'OPEN',
      assigneeId: body['assigneeId'],
      dueDate: body['dueDate'],
      beforePhotos,
      afterPhotos: [],
      history: [{ action: 'CREATED', byId: auth.user.id, at: now, note: '' }],
      createdById: auth.user.id,
      createdAt: now,
      updatedAt: now,
    });
    notifyPunch(record, [record.assigneeId], `Bạn được giao xử lý ${record.code}`, `${record.title} – hạn ${formatDate(record.dueDate)}.`, auth.user.id);
    return HttpResponse.json(toPunchDto(record), { status: 201 });
  }),

  /** Giao lại người xử lý / đổi hạn. */
  http.patch(apiUrl('/punch-items/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.verifyPunch);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findPunch(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const record = found.value;
    if (record.status === 'VERIFIED') {
      return errorResponse(409, 'INVALID_STATUS', 'Lỗi đã đóng, không thể giao lại.');
    }
    const project = db.projects.findById(record.projectId);
    const body = await readJsonBody(request);
    if (!isRecord(body) || !project) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const assigneeId = body['assigneeId'] ?? record.assigneeId;
    const dueDate = body['dueDate'] ?? record.dueDate;
    if (typeof assigneeId !== 'string' || !isProjectMember(project, assigneeId)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Người xử lý phải là thành viên dự án.');
    }
    if (!isValidIsoDate(dueDate)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Hạn xử lý không hợp lệ.');
    }
    const now = new Date().toISOString();
    const note = `${userSummary(assigneeId)?.fullName ?? ''} · hạn ${dueDate.split('-').reverse().join('/')}`;
    const updated = db.punchItems.update(record.id, {
      assigneeId,
      dueDate,
      history: [...record.history, { action: 'REASSIGNED', byId: auth.user.id, at: now, note }],
      updatedAt: now,
    });
    notifyPunch(record, [assigneeId], `Bạn được giao xử lý ${record.code}`, `${record.title} – hạn ${formatDate(dueDate)}.`, auth.user.id);
    return HttpResponse.json(toPunchDto(updated ?? record));
  }),

  http.post(apiUrl('/punch-items/:id/:transition'), async ({ request, params }) => {
    const transition = String(params['transition']) as PunchTransition;
    if (!['start', 'resolve', 'verify', 'reopen'].includes(transition)) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy thao tác.');
    }
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editQuality);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findPunch(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const record = found.value;
    const isVerifier = PERMISSIONS.verifyPunch.some((role) => role === auth.user.role);
    const isAssignee = record.assigneeId === auth.user.id;
    const body = await readJsonBody(request);
    const note = readNote(body);
    const now = new Date().toISOString();
    let changes: Partial<PunchRecord>;

    switch (transition) {
      case 'start':
        if (record.status !== 'OPEN') {
          return errorResponse(409, 'INVALID_STATUS', 'Chỉ bắt đầu xử lý được lỗi mới.');
        }
        if (!isAssignee && !isVerifier) {
          return errorResponse(403, 'FORBIDDEN', 'Chỉ người được giao hoặc quản lý mới cập nhật được.');
        }
        changes = { status: 'IN_PROGRESS' };
        break;
      case 'resolve': {
        if (record.status !== 'OPEN' && record.status !== 'IN_PROGRESS') {
          return errorResponse(409, 'INVALID_STATUS', 'Lỗi không ở trạng thái đang xử lý.');
        }
        if (!isAssignee && !isVerifier) {
          return errorResponse(403, 'FORBIDDEN', 'Chỉ người được giao hoặc quản lý mới cập nhật được.');
        }
        const afterPhotos: Photo[] | null = parseList(isRecord(body) ? (body['afterPhotos'] ?? []) : [], MAX_PHOTOS, parsePhoto);
        if (!afterPhotos || afterPhotos.length === 0) {
          return errorResponse(422, 'AFTER_PHOTO_REQUIRED', 'Cần ít nhất 1 ảnh sau khi khắc phục.');
        }
        changes = { status: 'RESOLVED', afterPhotos };
        break;
      }
      case 'verify':
      case 'reopen':
        if (record.status !== 'RESOLVED') {
          return errorResponse(409, 'INVALID_STATUS', 'Chỉ xác nhận / mở lại được lỗi đang chờ xác nhận.');
        }
        if (!isVerifier) {
          return errorResponse(403, 'FORBIDDEN', 'Chỉ quản lý dự án mới xác nhận được.');
        }
        if (transition === 'verify' && isAssignee) {
          return errorResponse(403, 'SELF_VERIFY', 'Người khắc phục không được tự xác nhận đóng lỗi.');
        }
        if (transition === 'reopen' && !note) {
          return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do mở lại.');
        }
        changes = { status: transition === 'verify' ? 'VERIFIED' : 'OPEN' };
        break;
    }

    const action = ({ start: 'STARTED', resolve: 'RESOLVED', verify: 'VERIFIED', reopen: 'REOPENED' } as const)[transition];
    const updated = db.punchItems.update(record.id, {
      ...changes,
      history: [...record.history, { action, byId: auth.user.id, at: now, note }],
      updatedAt: now,
    });
    if (transition === 'resolve') {
      notifyPunch(record, [projectManagerId(record.projectId)], `${record.code} chờ xác nhận khắc phục`, note || record.title, auth.user.id);
    } else if (transition === 'reopen' || transition === 'verify') {
      const title = transition === 'verify' ? `${record.code} đã được xác nhận đóng` : `${record.code} bị mở lại`;
      notifyPunch(record, [record.assigneeId], title, note ? `${auth.user.fullName}: “${note}”` : record.title, auth.user.id);
    }
    return HttpResponse.json(toPunchDto(updated ?? record));
  }),
];
