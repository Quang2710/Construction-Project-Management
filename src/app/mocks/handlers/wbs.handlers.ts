import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import { WbsNode } from '../../features/scheduling/models/wbs.model';
import { db } from '../db';
import { WbsRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { canViewProject, newId } from '../utils/serializers';

/** Gắn mã WBS (1, 1.1, 1.2...) theo thứ tự trong từng cấp; trả về theo thứ tự duyệt cây. */
export function withWbsCodes(records: readonly WbsRecord[]): WbsNode[] {
  const result: WbsNode[] = [];
  const visit = (parentId: string | null, prefix: string): void => {
    records
      .filter((record) => record.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((record, index) => {
        const code = prefix ? `${prefix}.${index + 1}` : String(index + 1);
        result.push({ ...record, code });
        visit(record.id, code);
      });
  };
  visit(null, '');
  return result;
}

export const wbsHandlers = [
  http.get(apiUrl('/projects/:id/wbs'), async ({ request, params }) => {
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
    return HttpResponse.json(withWbsCodes(db.wbs.filter((node) => node.projectId === project.id)));
  }),

  http.post(apiUrl('/projects/:id/wbs'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageProjects);
    if (!auth.ok) {
      return auth.response;
    }
    const project = db.projects.findById(String(params['id']));
    if (!project) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
    }
    const body = await readJsonBody(request);
    const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const name = typeof record['name'] === 'string' ? record['name'].trim() : '';
    const parentId = typeof record['parentId'] === 'string' ? record['parentId'] : null;
    if (!name || name.length > 200) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tên hạng mục là bắt buộc (tối đa 200 ký tự).');
    }
    if (parentId) {
      const parent = db.wbs.findById(parentId);
      if (!parent || parent.projectId !== project.id) {
        return errorResponse(422, 'VALIDATION_ERROR', 'Hạng mục cha không thuộc dự án.');
      }
    }
    const siblings = db.wbs.filter((node) => node.projectId === project.id && node.parentId === parentId);
    const created = db.wbs.insert({
      id: newId('wbs'),
      projectId: project.id,
      parentId,
      name,
      order: Math.max(0, ...siblings.map((node) => node.order)) + 1,
    });
    const node = withWbsCodes(db.wbs.filter((item) => item.projectId === project.id)).find((item) => item.id === created.id);
    return HttpResponse.json(node, { status: 201 });
  }),
];
