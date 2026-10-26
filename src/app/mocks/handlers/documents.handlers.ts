import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Discipline,
  DISCIPLINES,
  Drawing,
  DrawingFile,
  nextRevisionLabel,
} from '../../features/documents/models/document.model';
import { ApiError } from '../../shared/models/api.model';
import { UserSummary } from '../../shared/models/user.model';
import { db } from '../db';
import { fileStore } from '../file-store';
import { DrawingRecord, UserRecord } from '../models/mock-records';
import { notificationHub, projectTeamIds } from '../realtime/notification-hub';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { canViewProject, newId, toUserSummary } from '../utils/serializers';
import { isNumberInRange, isOneOf, isRecord, isText } from '../utils/validation';

const UNKNOWN_USER: UserSummary = { id: '', fullName: 'Người dùng đã xoá', jobTitle: '', role: 'CLIENT' };
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9.\-_]{1,19}$/;

type Failure = { readonly ok: false; readonly response: HttpResponse<ApiError> };

export function toDrawingDto(record: DrawingRecord): Drawing {
  const revisions = record.revisions.map(({ uploadedById, ...revision }) => {
    const user = db.users.findById(uploadedById);
    return { ...revision, uploadedBy: user ? toUserSummary(user) : UNKNOWN_USER };
  });
  return {
    ...record,
    projectCode: db.projects.findById(record.projectId)?.code ?? '—',
    revisions,
    currentRevision: revisions[revisions.length - 1],
  };
}

function findDrawing(user: UserRecord, id: string): { readonly ok: true; readonly value: DrawingRecord } | Failure {
  const drawing = db.drawings.findById(id);
  const project = drawing ? db.projects.findById(drawing.projectId) : undefined;
  if (!drawing || !project) {
    return { ok: false, response: errorResponse(404, 'NOT_FOUND', 'Không tìm thấy bản vẽ.') };
  }
  return canViewProject(user, project)
    ? { ok: true, value: drawing }
    : { ok: false, response: errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào dự án này.') };
}

/** File phải là PDF đã tải lên qua /uploads (kiểm tra trong kho file của fake BE). */
async function parseDrawingFile(value: unknown): Promise<DrawingFile | null> {
  if (!isRecord(value) || !isText(value['fileId'], 1, 100) || !isText(value['fileName'], 1, 255) || !isNumberInRange(value['size'], 1, 20 * 1024 * 1024)) {
    return null;
  }
  const stored = await fileStore.get(value['fileId']);
  if (!stored || stored.mimeType !== 'application/pdf') {
    return null;
  }
  return { fileId: stored.id, url: apiUrl(`/files/${stored.id}`), fileName: value['fileName'].trim(), size: stored.size };
}

function readDescription(body: Record<string, unknown>): string {
  return typeof body['description'] === 'string' ? body['description'].trim().slice(0, 500) : '';
}

export const documentsHandlers = [
  http.get(apiUrl('/projects/:id/drawings'), async ({ request, params }) => {
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
    const query = parseListQuery(new URL(request.url), { maxPageSize: 200 });
    const drawings = db.drawings.filter((drawing) => drawing.projectId === project.id).map(toDrawingDto);
    return HttpResponse.json(applyListQuery(drawings, { ...query, sort: query.sort ?? { field: 'code', direction: 'asc' } }, ['code', 'title']));
  }),

  http.get(apiUrl('/drawings/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findDrawing(auth.user, String(params['id']));
    return found.ok ? HttpResponse.json(toDrawingDto(found.value)) : found.response;
  }),

  http.post(apiUrl('/projects/:id/drawings'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageDocuments);
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
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const code = typeof body['code'] === 'string' ? body['code'].trim().toUpperCase() : '';
    if (!CODE_PATTERN.test(code)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Số hiệu bản vẽ 2–20 ký tự, chỉ gồm chữ in hoa, số, dấu - . _');
    }
    if (db.drawings.findOne((drawing) => drawing.projectId === project.id && drawing.code === code)) {
      return errorResponse(409, 'DRAWING_EXISTS', `Dự án đã có bản vẽ số hiệu ${code}. Hãy tải lên phiên bản mới cho bản vẽ đó.`);
    }
    if (!isText(body['title'], 1, 200)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tên bản vẽ là bắt buộc (tối đa 200 ký tự).');
    }
    if (!isOneOf<Discipline>(DISCIPLINES, body['discipline'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Bộ môn không hợp lệ.');
    }
    const file = await parseDrawingFile(body['file']);
    if (!file) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tệp bản vẽ phải là PDF đã tải lên (tối đa 20 MB).');
    }
    const now = new Date().toISOString();
    const id = newId('drw');
    const record = db.drawings.insert({
      id,
      projectId: project.id,
      code,
      title: body['title'].trim(),
      discipline: body['discipline'],
      revisions: [
        { id: `${id}-rA`, revision: 'A', description: readDescription(body) || 'Phát hành lần đầu.', file, issuedAt: now, uploadedById: auth.user.id },
      ],
      updatedAt: now,
    });
    return HttpResponse.json(toDrawingDto(record), { status: 201 });
  }),

  http.post(apiUrl('/drawings/:id/revisions'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageDocuments);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findDrawing(auth.user, String(params['id']));
    if (!found.ok) {
      return found.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const description = readDescription(body);
    if (!description) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng mô tả nội dung thay đổi của phiên bản mới.');
    }
    const file = await parseDrawingFile(body['file']);
    if (!file) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tệp bản vẽ phải là PDF đã tải lên (tối đa 20 MB).');
    }
    const drawing = found.value;
    const label = nextRevisionLabel(drawing.revisions[drawing.revisions.length - 1]?.revision ?? '');
    const now = new Date().toISOString();
    const updated = db.drawings.update(drawing.id, {
      revisions: [
        ...drawing.revisions,
        { id: `${drawing.id}-r${label}`, revision: label, description, file, issuedAt: now, uploadedById: auth.user.id },
      ],
      updatedAt: now,
    });
    notificationHub.notify(
      projectTeamIds(drawing.projectId),
      {
        type: 'DOCUMENT',
        title: `Bản vẽ ${drawing.code} phát hành Rev ${label}`,
        message: description,
        link: `/documents/${drawing.id}?rev=${label}`,
        projectId: drawing.projectId,
      },
      auth.user.id,
    );
    return HttpResponse.json(toDrawingDto(updated ?? drawing), { status: 201 });
  }),
];
