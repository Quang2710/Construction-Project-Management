import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Material,
  MATERIAL_CATEGORIES,
  MaterialCategory,
  MaterialRef,
  MaterialRequest,
  StockItem,
  StockTransaction,
  StockTransactionType,
} from '../../features/materials/models/material.model';
import { ApiError } from '../../shared/models/api.model';
import { UserSummary } from '../../shared/models/user.model';
import { isValidIsoDate } from '../../shared/utils/date.utils';
import { db } from '../db';
import { MaterialRecord, MaterialRequestRecord, StockRecord, StockTransactionRecord, UserRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { canViewProject, newId, toUserSummary } from '../utils/serializers';

const UNKNOWN_USER: UserSummary = { id: '', fullName: 'Người dùng đã xoá', jobTitle: '', role: 'CLIENT' };
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9.\-]{1,29}$/;

function userSummary(id: string): UserSummary {
  const user = db.users.findById(id);
  return user ? toUserSummary(user) : UNKNOWN_USER;
}

function materialRef(id: string): MaterialRef {
  const material = db.materials.findById(id);
  return material
    ? { id: material.id, code: material.code, name: material.name, unit: material.unit }
    : { id, code: '—', name: 'Vật tư đã xoá', unit: '' };
}

function projectCode(id: string): string {
  return db.projects.findById(id)?.code ?? '—';
}

function toStockItem(record: StockRecord, material: MaterialRecord): StockItem {
  return {
    id: record.id,
    projectId: record.projectId,
    projectCode: projectCode(record.projectId),
    material,
    quantity: record.quantity,
    minQuantity: record.minQuantity,
    value: record.quantity * material.unitPrice,
    isLow: record.quantity < record.minQuantity,
    updatedAt: record.updatedAt,
  };
}

function toTransaction(record: StockTransactionRecord): StockTransaction {
  const { materialId, createdById, ...rest } = record;
  return { ...rest, material: materialRef(materialId), createdBy: userSummary(createdById) };
}

function toRequest(record: MaterialRequestRecord): MaterialRequest {
  const { createdById, history, items, ...rest } = record;
  return {
    ...rest,
    projectCode: projectCode(record.projectId),
    items: items.map((item) => ({ material: materialRef(item.materialId), quantity: item.quantity, unitPrice: item.unitPrice })),
    totalValue: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    createdBy: userSummary(createdById),
    history: history.map((entry) => ({ action: entry.action, by: userSummary(entry.byId), at: entry.at, note: entry.note })),
  };
}

function visibleProjectIds(user: UserRecord): Set<string> {
  return new Set(db.projects.filter((project) => canViewProject(user, project)).map((project) => project.id));
}

function projectAccess(user: UserRecord, projectId: unknown): HttpResponse<ApiError> | null {
  const project = typeof projectId === 'string' ? db.projects.findById(projectId) : undefined;
  if (!project) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy công trường.');
  }
  return canViewProject(user, project) ? null : errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào công trường này.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNote(body: unknown): string {
  return isRecord(body) && typeof body['note'] === 'string' ? body['note'].trim().slice(0, 1000) : '';
}

function validateMaterial(body: unknown, currentId: string | null): Omit<Material, 'id'> | HttpResponse<ApiError> {
  if (!isRecord(body)) {
    return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
  }
  const code = typeof body['code'] === 'string' ? body['code'].trim().toUpperCase() : '';
  const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
  const unit = typeof body['unit'] === 'string' ? body['unit'].trim() : '';
  const category: unknown = body['category'];
  const unitPrice = body['unitPrice'];
  if (!CODE_PATTERN.test(code)) {
    return errorResponse(422, 'VALIDATION_ERROR', 'Mã vật tư 2–30 ký tự: chữ in hoa, số, dấu chấm hoặc gạch ngang.');
  }
  if (!name || name.length > 200 || !unit || unit.length > 20) {
    return errorResponse(422, 'VALIDATION_ERROR', 'Tên và đơn vị tính là bắt buộc.');
  }
  if (typeof category !== 'string' || !(MATERIAL_CATEGORIES as readonly string[]).includes(category)) {
    return errorResponse(422, 'VALIDATION_ERROR', 'Nhóm vật tư không hợp lệ.');
  }
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return errorResponse(422, 'VALIDATION_ERROR', 'Đơn giá phải ≥ 0.');
  }
  if (db.materials.findOne((material) => material.code === code && material.id !== currentId)) {
    return errorResponse(409, 'MATERIAL_CODE_EXISTS', `Mã vật tư "${code}" đã tồn tại.`);
  }
  const description = typeof body['description'] === 'string' ? body['description'].trim().slice(0, 1000) : '';
  return { code, name, unit, category: category as MaterialCategory, unitPrice: Math.round(unitPrice), description };
}

/** Ghi một giao dịch kho và cập nhật số tồn. OUT vượt tồn trả về lỗi. */
function postTransaction(
  user: UserRecord,
  projectId: string,
  materialId: string,
  type: StockTransactionType,
  quantity: number,
  note: string,
  requestId: string | null,
): StockTransactionRecord | HttpResponse<ApiError> {
  const material = db.materials.findById(materialId);
  if (!material) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy vật tư.');
  }
  const stockId = `${projectId}:${materialId}`;
  const current = db.stock.findById(stockId);
  const before = current?.quantity ?? 0;
  if (type === 'OUT' && quantity > before) {
    return errorResponse(
      422,
      'INSUFFICIENT_STOCK',
      `Không đủ tồn kho "${material.name}": còn ${before.toLocaleString('vi-VN')} ${material.unit}.`,
    );
  }
  const now = new Date().toISOString();
  const balanceAfter = type === 'IN' ? before + quantity : before - quantity;
  if (current) {
    db.stock.update(stockId, { quantity: balanceAfter, updatedAt: now });
  } else {
    db.stock.insert({ id: stockId, projectId, materialId, quantity: balanceAfter, minQuantity: 0, updatedAt: now });
  }
  const count = db.stockTransactions.filter((tx) => tx.type === type).length + 1;
  return db.stockTransactions.insert({
    id: newId('stx'),
    code: `${type === 'IN' ? 'PN' : 'PX'}-${String(count).padStart(5, '0')}`,
    projectId,
    materialId,
    type,
    quantity,
    unitPrice: material.unitPrice,
    balanceAfter,
    note,
    requestId,
    createdById: user.id,
    createdAt: now,
  });
}

function findRequest(user: UserRecord, id: string): MaterialRequestRecord | HttpResponse<ApiError> {
  const request = db.materialRequests.findById(id);
  if (!request) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy phiếu yêu cầu.');
  }
  return projectAccess(user, request.projectId) ?? request;
}

export const materialsHandlers = [
  // ----- Danh mục vật tư -----
  http.get(apiUrl('/materials'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const query = parseListQuery(new URL(request.url), { maxPageSize: 500 });
    return HttpResponse.json(applyListQuery(db.materials.all(), { ...query, sort: query.sort ?? { field: 'code', direction: 'asc' } }, ['code', 'name']));
  }),

  http.get(apiUrl('/materials/by-code/:code'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const code = decodeURIComponent(String(params['code'])).trim().toUpperCase();
    const material = db.materials.findOne((item) => item.code === code);
    return material ? HttpResponse.json(material) : errorResponse(404, 'NOT_FOUND', `Không có vật tư mã "${code}".`);
  }),

  http.post(apiUrl('/materials'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageMaterials);
    if (!auth.ok) {
      return auth.response;
    }
    const result = validateMaterial(await readJsonBody(request), null);
    if (result instanceof HttpResponse) {
      return result;
    }
    return HttpResponse.json(db.materials.insert({ ...result, id: newId('mat') }), { status: 201 });
  }),

  http.put(apiUrl('/materials/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageMaterials);
    if (!auth.ok) {
      return auth.response;
    }
    const id = String(params['id']);
    if (!db.materials.findById(id)) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy vật tư.');
    }
    const result = validateMaterial(await readJsonBody(request), id);
    if (result instanceof HttpResponse) {
      return result;
    }
    return HttpResponse.json(db.materials.update(id, result));
  }),

  // ----- Tồn kho -----
  http.get(apiUrl('/stock'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const lowOnly = url.searchParams.get('lowOnly') === 'true';
    if (projectId) {
      const denied = projectAccess(auth.user, projectId);
      if (denied) {
        return denied;
      }
    }
    const visible = visibleProjectIds(auth.user);
    const items = db.stock
      .filter((record) => (projectId ? record.projectId === projectId : visible.has(record.projectId)))
      .flatMap((record) => {
        const material = db.materials.findById(record.materialId);
        return material ? [toStockItem(record, material)] : [];
      })
      .filter((item) => !lowOnly || item.isLow)
      // Vật tư thiếu lên đầu, sau đó theo mã.
      .sort((a, b) => Number(b.isLow) - Number(a.isLow) || a.material.code.localeCompare(b.material.code));
    return HttpResponse.json(items);
  }),

  http.put(apiUrl('/stock/:projectId/:materialId'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageMaterials);
    if (!auth.ok) {
      return auth.response;
    }
    const projectId = String(params['projectId']);
    const materialId = String(params['materialId']);
    const denied = projectAccess(auth.user, projectId);
    if (denied) {
      return denied;
    }
    const material = db.materials.findById(materialId);
    if (!material) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy vật tư.');
    }
    const body = await readJsonBody(request);
    const minQuantity = isRecord(body) ? body['minQuantity'] : undefined;
    if (typeof minQuantity !== 'number' || !Number.isFinite(minQuantity) || minQuantity < 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Mức tồn tối thiểu phải ≥ 0.');
    }
    const id = `${projectId}:${materialId}`;
    const now = new Date().toISOString();
    const record = db.stock.findById(id)
      ? db.stock.update(id, { minQuantity, updatedAt: now })
      : db.stock.insert({ id, projectId, materialId, quantity: 0, minQuantity, updatedAt: now });
    return record ? HttpResponse.json(toStockItem(record, material)) : errorResponse(404, 'NOT_FOUND', 'Không tìm thấy.');
  }),

  // ----- Giao dịch nhập/xuất -----
  http.get(apiUrl('/stock-transactions'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const visible = visibleProjectIds(auth.user);
    const query = parseListQuery(new URL(request.url));
    const items = db.stockTransactions.filter((tx) => visible.has(tx.projectId)).map(toTransaction);
    return HttpResponse.json(
      applyListQuery(items, { ...query, sort: query.sort ?? { field: 'createdAt', direction: 'desc' } }, ['code', 'note']),
    );
  }),

  http.post(apiUrl('/stock-transactions'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const denied = projectAccess(auth.user, body['projectId']);
    if (denied) {
      return denied;
    }
    const { materialId, type, quantity } = body;
    if (typeof materialId !== 'string' || (type !== 'IN' && type !== 'OUT')) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vật tư hoặc loại phiếu không hợp lệ.');
    }
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Số lượng phải lớn hơn 0.');
    }
    const result = postTransaction(auth.user, String(body['projectId']), materialId, type, quantity, readNote(body), null);
    return result instanceof HttpResponse ? result : HttpResponse.json(toTransaction(result), { status: 201 });
  }),

  // ----- Phiếu yêu cầu vật tư -----
  http.get(apiUrl('/material-requests'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const visible = visibleProjectIds(auth.user);
    const query = parseListQuery(new URL(request.url));
    const items = db.materialRequests.filter((item) => visible.has(item.projectId)).map(toRequest);
    return HttpResponse.json(
      applyListQuery(items, { ...query, sort: query.sort ?? { field: 'createdAt', direction: 'desc' } }, ['code', 'note']),
    );
  }),

  http.get(apiUrl('/material-requests/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findRequest(auth.user, String(params['id']));
    return found instanceof HttpResponse ? found : HttpResponse.json(toRequest(found));
  }),

  http.post(apiUrl('/material-requests'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.handleStock);
    if (!auth.ok) {
      return auth.response;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const denied = projectAccess(auth.user, body['projectId']);
    if (denied) {
      return denied;
    }
    const rawItems = body['items'];
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 20) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Phiếu cần 1–20 dòng vật tư.');
    }
    const items: MaterialRequestRecord['items'][number][] = [];
    for (const item of rawItems) {
      const material = isRecord(item) && typeof item['materialId'] === 'string' ? db.materials.findById(item['materialId']) : undefined;
      const quantity = isRecord(item) ? item['quantity'] : undefined;
      if (!material || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
        return errorResponse(422, 'VALIDATION_ERROR', 'Mỗi dòng cần vật tư hợp lệ và số lượng > 0.');
      }
      if (items.some((existing) => existing.materialId === material.id)) {
        return errorResponse(422, 'VALIDATION_ERROR', `Vật tư "${material.name}" bị lặp trong phiếu.`);
      }
      items.push({ materialId: material.id, quantity, unitPrice: material.unitPrice });
    }
    if (!isValidIsoDate(body['neededBy'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Ngày cần vật tư không hợp lệ.');
    }
    const now = new Date().toISOString();
    const record = db.materialRequests.insert({
      id: newId('mrq'),
      code: `YC-${String(db.materialRequests.all().length + 1).padStart(4, '0')}`,
      projectId: String(body['projectId']),
      items,
      neededBy: body['neededBy'],
      note: readNote(body),
      status: 'PENDING',
      createdById: auth.user.id,
      reviewNote: '',
      history: [{ action: 'CREATED', byId: auth.user.id, at: now, note: '' }],
      createdAt: now,
    });
    return HttpResponse.json(toRequest(record), { status: 201 });
  }),

  http.post(apiUrl('/material-requests/:id/:action'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const action = String(params['action']);
    if (!['approve', 'reject', 'receive'].includes(action)) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy thao tác.');
    }
    const roles = action === 'receive' ? PERMISSIONS.handleStock : PERMISSIONS.approveMaterialRequests;
    const auth = authenticate(request, roles);
    if (!auth.ok) {
      return auth.response;
    }
    const found = findRequest(auth.user, String(params['id']));
    if (found instanceof HttpResponse) {
      return found;
    }
    const note = readNote(await readJsonBody(request));
    const now = new Date().toISOString();

    if (action === 'receive') {
      if (found.status !== 'APPROVED') {
        return errorResponse(409, 'INVALID_STATUS', 'Chỉ nhập kho được phiếu đã duyệt.');
      }
      for (const item of found.items) {
        const result = postTransaction(auth.user, found.projectId, item.materialId, 'IN', item.quantity, `Nhập kho theo phiếu ${found.code}`, found.id);
        if (result instanceof HttpResponse) {
          return result;
        }
      }
      const updated = db.materialRequests.update(found.id, {
        status: 'RECEIVED',
        history: [...found.history, { action: 'RECEIVED', byId: auth.user.id, at: now, note }],
      });
      return HttpResponse.json(toRequest(updated ?? found));
    }

    if (found.status !== 'PENDING') {
      return errorResponse(409, 'INVALID_STATUS', 'Chỉ duyệt/từ chối được phiếu đang chờ duyệt.');
    }
    if (action === 'reject' && !note) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối.');
    }
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updated = db.materialRequests.update(found.id, {
      status,
      reviewNote: note,
      history: [...found.history, { action: status, byId: auth.user.id, at: now, note }],
    });
    return HttpResponse.json(toRequest(updated ?? found));
  }),
];
