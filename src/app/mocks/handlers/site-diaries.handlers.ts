import { http, HttpResponse } from 'msw';
import { environment } from '../../../environments/environment';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  DiaryAction,
  DiaryContent,
  DiaryPhoto,
  DiaryStatus,
  EDITABLE_DIARY_STATUSES,
  EquipmentEntry,
  GeoPoint,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  IncidentEntry,
  IncidentSeverity,
  IncidentType,
  LaborEntry,
  SiteDiary,
  WEATHER_CONDITIONS,
  WeatherCondition,
  WorkItemEntry,
} from '../../features/site-diaries/models/site-diary.model';
import { ApiError } from '../../shared/models/api.model';
import { UserRole } from '../../shared/models/user.model';
import { isValidIsoDate, todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { SiteDiaryRecord, UserRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { canViewProject, newId, toDiaryDto } from '../utils/serializers';

const MAX_PAGE_SIZE = 500;
const FILE_URL_PREFIX = `${environment.apiBaseUrl}/files/`;

type Failure = { readonly ok: false; readonly response: HttpResponse<ApiError> };
type Success<T> = { readonly ok: true; readonly value: T };

function fail(status: 403 | 404 | 409 | 422, code: string, message: string): Failure {
  return { ok: false, response: errorResponse(status, code, message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Kiểm tra từng phần tử của mảng; trả về null nếu có phần tử sai. */
function parseList<T>(value: unknown, max: number, parse: (item: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) {
    return null;
  }
  const result: T[] = [];
  for (const item of value) {
    const parsed = isRecord(item) ? parse(item) : null;
    if (!parsed) {
      return null;
    }
    result.push(parsed);
  }
  return result;
}

function parseLabor(item: Record<string, unknown>): LaborEntry | null {
  return isText(item['crew'], 1, 100) && isNumberInRange(item['headcount'], 0, 1000) && Number.isInteger(item['headcount'])
    ? { crew: item['crew'].trim(), headcount: item['headcount'] }
    : null;
}

function parseEquipment(item: Record<string, unknown>): EquipmentEntry | null {
  const hours = item['hours'];
  if (!isText(item['name'], 1, 100) || !isNumberInRange(item['quantity'], 1, 100) || !Number.isInteger(item['quantity'])) {
    return null;
  }
  if (hours !== null && hours !== undefined && !isNumberInRange(hours, 0, 24)) {
    return null;
  }
  return { name: item['name'].trim(), quantity: item['quantity'], hours: typeof hours === 'number' ? hours : null };
}

function parseWorkItem(item: Record<string, unknown>): WorkItemEntry | null {
  return isText(item['description'], 1, 300) && isText(item['unit'], 1, 20) && isNumberInRange(item['quantity'], 0, 1e9)
    ? { description: item['description'].trim(), unit: item['unit'].trim(), quantity: item['quantity'] }
    : null;
}

function parseIncident(item: Record<string, unknown>): IncidentEntry | null {
  const type: unknown = item['type'];
  const severity: unknown = item['severity'];
  if (!isOneOf<IncidentType>(INCIDENT_TYPES, type) || !isOneOf<IncidentSeverity>(INCIDENT_SEVERITIES, severity)) {
    return null;
  }
  if (!isText(item['description'], 1, 1000)) {
    return null;
  }
  const actionTaken = typeof item['actionTaken'] === 'string' ? item['actionTaken'].trim().slice(0, 1000) : '';
  return { type, severity, description: item['description'].trim(), actionTaken };
}

function parseLocation(value: unknown): GeoPoint | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value) || !isNumberInRange(value['lat'], -90, 90) || !isNumberInRange(value['lng'], -180, 180)) {
    return undefined;
  }
  const accuracy = value['accuracy'];
  return { lat: value['lat'], lng: value['lng'], accuracy: typeof accuracy === 'number' ? accuracy : null };
}

function parsePhoto(item: Record<string, unknown>): DiaryPhoto | null {
  const location = parseLocation(item['location']);
  if (
    location === undefined ||
    !isText(item['id'], 1, 100) ||
    typeof item['url'] !== 'string' ||
    !item['url'].startsWith(FILE_URL_PREFIX) ||
    !isText(item['fileName'], 1, 255) ||
    !isText(item['mimeType'], 1, 100) ||
    !isNumberInRange(item['size'], 0, 50 * 1024 * 1024) ||
    typeof item['takenAt'] !== 'string'
  ) {
    return null;
  }
  return {
    id: item['id'],
    url: item['url'],
    fileName: item['fileName'],
    mimeType: item['mimeType'],
    size: item['size'],
    caption: typeof item['caption'] === 'string' ? item['caption'].trim().slice(0, 200) : '',
    takenAt: item['takenAt'],
    location,
  };
}

/** Kiểm tra nội dung nhật ký giống BE thật, thông báo lỗi tiếng Việt. */
function validateContent(body: Record<string, unknown>): Success<DiaryContent> | Failure {
  const weather = body['weather'];
  if (
    !isRecord(weather) ||
    !isOneOf<WeatherCondition>(WEATHER_CONDITIONS, weather['morning']) ||
    !isOneOf<WeatherCondition>(WEATHER_CONDITIONS, weather['afternoon'])
  ) {
    return fail(422, 'VALIDATION_ERROR', 'Thông tin thời tiết không hợp lệ.');
  }
  const minTemp = weather['minTemp'] ?? null;
  const maxTemp = weather['maxTemp'] ?? null;
  if (
    (minTemp !== null && !isNumberInRange(minTemp, -10, 50)) ||
    (maxTemp !== null && !isNumberInRange(maxTemp, -10, 50)) ||
    (typeof minTemp === 'number' && typeof maxTemp === 'number' && minTemp > maxTemp)
  ) {
    return fail(422, 'VALIDATION_ERROR', 'Nhiệt độ không hợp lệ (thấp nhất phải ≤ cao nhất).');
  }

  const labor = parseList(body['labor'] ?? [], 30, parseLabor);
  if (!labor) {
    return fail(422, 'VALIDATION_ERROR', 'Danh sách nhân công không hợp lệ.');
  }
  const equipment = parseList(body['equipment'] ?? [], 30, parseEquipment);
  if (!equipment) {
    return fail(422, 'VALIDATION_ERROR', 'Danh sách máy móc không hợp lệ.');
  }
  const workItems = parseList(body['workItems'] ?? [], 50, parseWorkItem);
  if (!workItems) {
    return fail(422, 'VALIDATION_ERROR', 'Khối lượng hoàn thành không hợp lệ.');
  }
  const incidents = parseList(body['incidents'] ?? [], 20, parseIncident);
  if (!incidents) {
    return fail(422, 'VALIDATION_ERROR', 'Thông tin sự cố không hợp lệ.');
  }
  const photos = parseList(body['photos'] ?? [], 30, parsePhoto);
  if (!photos) {
    return fail(422, 'VALIDATION_ERROR', 'Danh sách ảnh không hợp lệ (tối đa 30 ảnh).');
  }
  const notes = body['notes'] ?? '';
  if (typeof notes !== 'string' || notes.length > 4000) {
    return fail(422, 'VALIDATION_ERROR', 'Ghi chú tối đa 4000 ký tự.');
  }

  return {
    ok: true,
    value: {
      weather: { morning: weather['morning'], afternoon: weather['afternoon'], minTemp, maxTemp },
      labor,
      equipment,
      workItems,
      incidents,
      notes: notes.trim(),
      photos,
    },
  };
}

/** CLIENT chỉ xem nhật ký đã duyệt; kỹ sư chỉ xem dự án được gán. */
function canViewDiary(user: UserRecord, diary: SiteDiaryRecord): boolean {
  const project = db.projects.findById(diary.projectId);
  if (!project || !canViewProject(user, project)) {
    return false;
  }
  return user.role !== 'CLIENT' || diary.status === 'APPROVED';
}

function findDiary(user: UserRecord, id: string): Success<SiteDiaryRecord> | Failure {
  const diary = db.siteDiaries.findById(id);
  if (!diary) {
    return fail(404, 'NOT_FOUND', 'Không tìm thấy nhật ký.');
  }
  if (!canViewDiary(user, diary)) {
    return fail(403, 'FORBIDDEN', 'Bạn không có quyền xem nhật ký này.');
  }
  return { ok: true, value: diary };
}

function requireRole(user: UserRecord, roles: readonly UserRole[]): Failure | null {
  return roles.includes(user.role) ? null : fail(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
}

function transition(
  diary: SiteDiaryRecord,
  user: UserRecord,
  status: DiaryStatus,
  action: DiaryAction,
  note = '',
): SiteDiary {
  const now = new Date().toISOString();
  const updated = db.siteDiaries.update(diary.id, {
    status,
    reviewNote: action === 'APPROVED' || action === 'REJECTED' ? note : diary.reviewNote,
    history: [...diary.history, { action, byId: user.id, at: now, note }],
    updatedAt: now,
  });
  return toDiaryDto(updated ?? diary);
}

function readNote(body: unknown): string {
  return isRecord(body) && typeof body['note'] === 'string' ? body['note'].trim().slice(0, 1000) : '';
}

export const siteDiariesHandlers = [
  http.get(apiUrl('/site-diaries'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const query = parseListQuery(url, { maxPageSize: MAX_PAGE_SIZE });
    const diaries = db.siteDiaries
      .filter((diary) => canViewDiary(auth.user, diary))
      .filter((diary) => (!from || diary.date >= from) && (!to || diary.date <= to))
      .map(toDiaryDto);
    return HttpResponse.json(
      applyListQuery(diaries, { ...query, sort: query.sort ?? { field: 'date', direction: 'desc' } }, ['notes']),
    );
  }),

  http.get(apiUrl('/site-diaries/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findDiary(auth.user, String(params['id']));
    return found.ok ? HttpResponse.json(toDiaryDto(found.value)) : found.response;
  }),

  http.post(apiUrl('/site-diaries'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editDiaries);
    if (!auth.ok) {
      return auth.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body['projectId'] !== 'string') {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng chọn dự án.');
    }
    const project = db.projects.findById(body['projectId']);
    if (!project) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
    }
    if (!canViewProject(auth.user, project)) {
      return errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào dự án này.');
    }
    const date = body['date'];
    if (!isValidIsoDate(date)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Ngày báo cáo không hợp lệ.');
    }
    if (date > todayIso()) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Không thể lập nhật ký cho ngày trong tương lai.');
    }
    if (db.siteDiaries.findOne((diary) => diary.projectId === project.id && diary.date === date)) {
      return errorResponse(409, 'DIARY_EXISTS', 'Dự án đã có nhật ký cho ngày này.');
    }
    const content = validateContent(body);
    if (!content.ok) {
      return content.response;
    }
    const now = new Date().toISOString();
    const record = db.siteDiaries.insert({
      ...content.value,
      id: newId('dry'),
      projectId: project.id,
      date,
      status: 'DRAFT',
      createdById: auth.user.id,
      reviewNote: '',
      history: [{ action: 'CREATED', byId: auth.user.id, at: now, note: '' }],
      createdAt: now,
      updatedAt: now,
    });
    return HttpResponse.json(toDiaryDto(record), { status: 201 });
  }),

  http.put(apiUrl('/site-diaries/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editDiaries);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findDiary(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const diary = found.value;
    if (!EDITABLE_DIARY_STATUSES.includes(diary.status)) {
      return errorResponse(409, 'DIARY_LOCKED', 'Nhật ký đã gửi duyệt hoặc đã duyệt, không thể sửa.');
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ.');
    }
    const content = validateContent(body);
    if (!content.ok) {
      return content.response;
    }
    const now = new Date().toISOString();
    // Chỉ ghi lịch sử khi sửa nhật ký bị trả lại (bản nháp sửa nhiều lần không cần).
    const history =
      diary.status === 'REJECTED' ? [...diary.history, { action: 'UPDATED' as const, byId: auth.user.id, at: now, note: '' }] : diary.history;
    const updated = db.siteDiaries.update(diary.id, { ...content.value, history, updatedAt: now });
    return HttpResponse.json(toDiaryDto(updated ?? diary));
  }),

  http.delete(apiUrl('/site-diaries/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editDiaries);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findDiary(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    if (found.value.status !== 'DRAFT') {
      return errorResponse(409, 'DIARY_LOCKED', 'Chỉ xoá được nhật ký ở trạng thái bản nháp.');
    }
    db.siteDiaries.remove(found.value.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(apiUrl('/site-diaries/:id/submit'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.editDiaries);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findDiary(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    if (!EDITABLE_DIARY_STATUSES.includes(found.value.status)) {
      return errorResponse(409, 'INVALID_STATUS', 'Chỉ gửi duyệt được bản nháp hoặc nhật ký bị trả lại.');
    }
    return HttpResponse.json(transition(found.value, auth.user, 'SUBMITTED', 'SUBMITTED'));
  }),

  http.post(apiUrl('/site-diaries/:id/approve'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const denied = requireRole(auth.user, PERMISSIONS.approveDiaries);
    if (denied) {
      return denied.response;
    }
    const found = findDiary(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    if (found.value.status !== 'SUBMITTED') {
      return errorResponse(409, 'INVALID_STATUS', 'Chỉ duyệt được nhật ký đang chờ duyệt.');
    }
    const note = readNote(await readJsonBody(request));
    return HttpResponse.json(transition(found.value, auth.user, 'APPROVED', 'APPROVED', note));
  }),

  http.post(apiUrl('/site-diaries/:id/reject'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const denied = requireRole(auth.user, PERMISSIONS.approveDiaries);
    if (denied) {
      return denied.response;
    }
    const found = findDiary(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    if (found.value.status !== 'SUBMITTED') {
      return errorResponse(409, 'INVALID_STATUS', 'Chỉ trả lại được nhật ký đang chờ duyệt.');
    }
    const note = readNote(await readJsonBody(request));
    if (!note) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do trả lại.');
    }
    return HttpResponse.json(transition(found.value, auth.user, 'REJECTED', 'REJECTED', note));
  }),
];
