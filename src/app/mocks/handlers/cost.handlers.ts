import { format, startOfMonth, subMonths } from 'date-fns';
import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  ChangeOrder,
  COST_CATEGORIES,
  CostCategory,
  CostEntry,
  CostItemSummary,
  CostSummary,
  PaymentMilestone,
  ProfitLossRow,
} from '../../features/cost/models/cost.model';
import { PROJECT_STATUS_LABELS } from '../../features/projects/models/project.model';
import { ApiError } from '../../shared/models/api.model';
import { UserSummary } from '../../shared/models/user.model';
import { isValidIsoDate, parseIsoDate, todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { ChangeOrderRecord, CostEntryRecord, PaymentRecord, ProjectRecord, UserRecord } from '../models/mock-records';
import { authenticate } from '../utils/auth.utils';
import { costItemProgress } from '../utils/cost-metrics';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { actualProgress } from '../utils/project-metrics';
import { canViewProject, newId, toUserSummary } from '../utils/serializers';

const UNKNOWN_USER: UserSummary = { id: '', fullName: 'Người dùng đã xoá', jobTitle: '', role: 'CLIENT' };
const MONTHS = 12;
/** Dưới mức này % hoàn thành quá nhỏ để ngoại suy chi phí. */
const MIN_PROGRESS_FOR_FORECAST = 5;

type Failure = HttpResponse<ApiError>;

function userSummary(id: string): UserSummary {
  const user = db.users.findById(id);
  return user ? toUserSummary(user) : UNKNOWN_USER;
}

function itemName(id: string): string {
  return db.costItems.findById(id)?.name ?? 'Hạng mục đã xoá';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findProject(user: UserRecord, id: string): ProjectRecord | Failure {
  const project = db.projects.findById(id);
  if (!project) {
    return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy dự án.');
  }
  return canViewProject(user, project) ? project : errorResponse(403, 'FORBIDDEN', 'Bạn không được gán vào dự án này.');
}

function toEntry(record: CostEntryRecord): CostEntry {
  const { createdById, ...rest } = record;
  return { ...rest, costItemName: itemName(record.costItemId), createdBy: userSummary(createdById) };
}

function toChangeOrder(record: ChangeOrderRecord): ChangeOrder {
  const { createdById, ...rest } = record;
  return { ...rest, costItemName: itemName(record.costItemId), createdBy: userSummary(createdById) };
}

function toPayment(record: PaymentRecord): PaymentMilestone {
  return { ...record, isOverdue: record.status !== 'PAID' && record.dueDate < todayIso() && record.status === 'INVOICED' };
}

/** Tổng hợp tài chính dự án; includeProfit = false với CLIENT. */
export function buildCostSummary(project: ProjectRecord, includeProfit: boolean, now = new Date()): CostSummary {
  const tasks = db.tasks.filter((task) => task.projectId === project.id);
  const wbs = db.wbs.filter((node) => node.projectId === project.id);
  const entries = db.costEntries.filter((entry) => entry.projectId === project.id);
  const payments = db.payments.filter((payment) => payment.projectId === project.id);
  const originalContract = db.contracts.findById(project.id)?.originalContract ?? project.budget;
  const approvedChanges = db.changeOrders
    .filter((order) => order.projectId === project.id && order.status === 'APPROVED')
    .reduce((sum, order) => sum + order.revenueAmount, 0);
  const contractValue = originalContract + approvedChanges;

  const items: CostItemSummary[] = db.costItems
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const actual = entries.filter((entry) => entry.costItemId === item.id).reduce((sum, entry) => sum + entry.amount, 0);
      const progress = costItemProgress(item.wbsId, wbs, tasks);
      const percentUsed = item.budget > 0 ? Math.round((actual / item.budget) * 100) : 0;
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        budget: item.budget,
        actual,
        variance: item.budget - actual,
        percentUsed,
        progress,
        overrun: actual > item.budget || percentUsed - progress > 10,
      };
    });

  const actualCost = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const costBudget = items.reduce((sum, item) => sum + item.budget, 0);
  const progress = actualProgress(tasks);
  const earnedRevenue = Math.round((contractValue * progress) / 100);
  const billed = payments.filter((payment) => payment.status !== 'PLANNED').reduce((sum, payment) => sum + payment.amount, 0);
  const received = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const forecastCost = progress >= MIN_PROGRESS_FOR_FORECAST ? Math.round((actualCost * 100) / progress) : costBudget;
  const forecastProfit = contractValue - forecastCost;

  const monthStart = startOfMonth(subMonths(now, MONTHS - 1));
  const monthly = Array.from({ length: MONTHS }, (_, index) => {
    const month = format(subMonths(now, MONTHS - 1 - index), 'MM/yyyy');
    return { month, cost: 0, received: 0 };
  });
  const monthIndex = (iso: string): number => {
    const date = parseIsoDate(iso);
    return (date.getFullYear() - monthStart.getFullYear()) * 12 + date.getMonth() - monthStart.getMonth();
  };
  for (const entry of entries) {
    const index = monthIndex(entry.date);
    if (index >= 0 && index < MONTHS) {
      monthly[index] = { ...monthly[index], cost: monthly[index].cost + entry.amount };
    }
  }
  for (const payment of payments) {
    const index = payment.paidAt ? monthIndex(payment.paidAt) : -1;
    if (index >= 0 && index < MONTHS) {
      monthly[index] = { ...monthly[index], received: monthly[index].received + payment.paidAmount };
    }
  }

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    originalContract,
    approvedChanges,
    contractValue,
    costBudget,
    actualCost,
    progress,
    earnedRevenue,
    billed,
    received,
    receivable: billed - received,
    profitToDate: includeProfit ? earnedRevenue - actualCost : null,
    forecastCost: includeProfit ? forecastCost : null,
    forecastProfit: includeProfit ? forecastProfit : null,
    forecastMargin: includeProfit && contractValue > 0 ? Math.round((forecastProfit / contractValue) * 1000) / 10 : null,
    items,
    byCategory: COST_CATEGORIES.map((category) => ({
      category,
      amount: entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amount, 0),
    })),
    monthly,
  };
}

/** Đồng bộ actualCost của dự án với tổng chi phí thực tế (dashboard, cảnh báo vượt ngân sách dùng số này). */
function syncProjectCost(projectId: string): void {
  const actualCost = db.costEntries.filter((entry) => entry.projectId === projectId).reduce((sum, entry) => sum + entry.amount, 0);
  db.projects.update(projectId, { actualCost, updatedAt: new Date().toISOString() });
}

export const costHandlers = [
  http.get(apiUrl('/projects/:id/cost-summary'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.viewCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const project = findProject(auth.user, String(params['id']));
    if (project instanceof HttpResponse) {
      return project;
    }
    return HttpResponse.json(buildCostSummary(project, PERMISSIONS.manageCosts.some((role) => role === auth.user.role)));
  }),

  http.get(apiUrl('/cost/overview'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const rows: ProfitLossRow[] = db.projects
      .filter((project) => canViewProject(auth.user, project) && project.status !== 'CANCELLED')
      .map((project) => {
        const { items: _items, byCategory: _byCategory, monthly: _monthly, ...summary } = buildCostSummary(project, true);
        return { ...summary, status: PROJECT_STATUS_LABELS[project.status] };
      });
    return HttpResponse.json(rows);
  }),

  http.get(apiUrl('/projects/:id/cost-entries'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.viewCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const project = findProject(auth.user, String(params['id']));
    if (project instanceof HttpResponse) {
      return project;
    }
    const query = parseListQuery(new URL(request.url), { maxPageSize: 1000 });
    const entries = db.costEntries.filter((entry) => entry.projectId === project.id).map(toEntry);
    return HttpResponse.json(
      applyListQuery(entries, { ...query, sort: query.sort ?? { field: 'date', direction: 'desc' } }, ['description', 'vendor', 'documentNo']),
    );
  }),

  http.post(apiUrl('/projects/:id/cost-entries'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const project = findProject(auth.user, String(params['id']));
    if (project instanceof HttpResponse) {
      return project;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const item = typeof body['costItemId'] === 'string' ? db.costItems.findById(body['costItemId']) : undefined;
    const category: unknown = body['category'];
    const amount = body['amount'];
    const description = typeof body['description'] === 'string' ? body['description'].trim() : '';
    if (!item || item.projectId !== project.id) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Hạng mục chi phí không thuộc dự án.');
    }
    if (typeof category !== 'string' || !(COST_CATEGORIES as readonly string[]).includes(category)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Loại chi phí không hợp lệ.');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Số tiền phải lớn hơn 0.');
    }
    if (!isValidIsoDate(body['date']) || body['date'] > todayIso()) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Ngày chứng từ không hợp lệ (không được ở tương lai).');
    }
    if (!description || description.length > 300) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Nội dung chi phí là bắt buộc (tối đa 300 ký tự).');
    }
    const record = db.costEntries.insert({
      id: newId('cen'),
      projectId: project.id,
      costItemId: item.id,
      date: body['date'],
      category: category as CostCategory,
      description,
      vendor: typeof body['vendor'] === 'string' ? body['vendor'].trim().slice(0, 200) : '',
      documentNo: typeof body['documentNo'] === 'string' ? body['documentNo'].trim().slice(0, 50) : '',
      amount: Math.round(amount),
      createdById: auth.user.id,
      createdAt: new Date().toISOString(),
    });
    syncProjectCost(project.id);
    return HttpResponse.json(toEntry(record), { status: 201 });
  }),

  http.get(apiUrl('/projects/:id/change-orders'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.viewCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const project = findProject(auth.user, String(params['id']));
    if (project instanceof HttpResponse) {
      return project;
    }
    const orders = db.changeOrders
      .filter((order) => order.projectId === project.id)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(toChangeOrder);
    return HttpResponse.json(orders);
  }),

  http.post(apiUrl('/projects/:id/change-orders'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const project = findProject(auth.user, String(params['id']));
    if (project instanceof HttpResponse) {
      return project;
    }
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.');
    }
    const title = typeof body['title'] === 'string' ? body['title'].trim() : '';
    const item = typeof body['costItemId'] === 'string' ? db.costItems.findById(body['costItemId']) : undefined;
    const { costAmount, revenueAmount } = body;
    if (!title || title.length > 200) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Tên phát sinh là bắt buộc.');
    }
    if (!item || item.projectId !== project.id) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Hạng mục chi phí không thuộc dự án.');
    }
    if (
      typeof costAmount !== 'number' ||
      typeof revenueAmount !== 'number' ||
      !Number.isFinite(costAmount) ||
      !Number.isFinite(revenueAmount) ||
      costAmount < 0 ||
      revenueAmount < 0
    ) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Giá trị chi phí/doanh thu phát sinh phải ≥ 0.');
    }
    if (!isValidIsoDate(body['date'])) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Ngày phát sinh không hợp lệ.');
    }
    const count = db.changeOrders.filter((order) => order.projectId === project.id).length + 1;
    const record = db.changeOrders.insert({
      id: newId('cho'),
      projectId: project.id,
      code: `PS-${String(count).padStart(2, '0')}`,
      title,
      description: typeof body['description'] === 'string' ? body['description'].trim().slice(0, 2000) : '',
      costItemId: item.id,
      costAmount: Math.round(costAmount),
      revenueAmount: Math.round(revenueAmount),
      status: 'PROPOSED',
      date: body['date'],
      decisionNote: '',
      createdById: auth.user.id,
    });
    return HttpResponse.json(toChangeOrder(record), { status: 201 });
  }),

  http.post(apiUrl('/change-orders/:id/:action'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const action = String(params['action']);
    if (action !== 'approve' && action !== 'reject') {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy thao tác.');
    }
    const auth = authenticate(request, PERMISSIONS.manageCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const order = db.changeOrders.findById(String(params['id']));
    if (!order) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy phát sinh.');
    }
    const project = findProject(auth.user, order.projectId);
    if (project instanceof HttpResponse) {
      return project;
    }
    if (order.status !== 'PROPOSED') {
      return errorResponse(409, 'INVALID_STATUS', 'Phát sinh đã được quyết định.');
    }
    const body = await readJsonBody(request);
    const note = isRecord(body) && typeof body['note'] === 'string' ? body['note'].trim().slice(0, 1000) : '';
    if (action === 'reject' && !note) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do không chấp thuận.');
    }
    const updated = db.changeOrders.update(order.id, { status: action === 'approve' ? 'APPROVED' : 'REJECTED', decisionNote: note });
    if (action === 'approve') {
      // Chấp thuận: tăng dự toán hạng mục và ngân sách dự án.
      const item = db.costItems.findById(order.costItemId);
      if (item) {
        db.costItems.update(item.id, { budget: item.budget + order.costAmount });
      }
      db.projects.update(project.id, { budget: project.budget + order.costAmount, updatedAt: new Date().toISOString() });
    }
    return HttpResponse.json(toChangeOrder(updated ?? order));
  }),

  http.get(apiUrl('/projects/:id/payments'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.viewCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const project = findProject(auth.user, String(params['id']));
    if (project instanceof HttpResponse) {
      return project;
    }
    const payments = db.payments
      .filter((payment) => payment.projectId === project.id)
      .sort((a, b) => a.order - b.order)
      .map(toPayment);
    return HttpResponse.json(payments);
  }),

  http.patch(apiUrl('/payments/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, PERMISSIONS.manageCosts);
    if (!auth.ok) {
      return auth.response;
    }
    const payment = db.payments.findById(String(params['id']));
    if (!payment) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy đợt thanh toán.');
    }
    const project = findProject(auth.user, payment.projectId);
    if (project instanceof HttpResponse) {
      return project;
    }
    const body = await readJsonBody(request);
    const status = isRecord(body) ? body['status'] : undefined;
    const today = todayIso();
    if (status === 'INVOICED' && payment.status === 'PLANNED') {
      return HttpResponse.json(toPayment(db.payments.update(payment.id, { status: 'INVOICED', invoicedAt: today }) ?? payment));
    }
    if (status === 'PAID' && payment.status === 'INVOICED') {
      const paidAmount = isRecord(body) && typeof body['paidAmount'] === 'number' ? body['paidAmount'] : payment.amount;
      if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > payment.amount) {
        return errorResponse(422, 'VALIDATION_ERROR', 'Số tiền thực nhận phải > 0 và không vượt giá trị đợt.');
      }
      return HttpResponse.json(
        toPayment(db.payments.update(payment.id, { status: 'PAID', paidAt: today, paidAmount: Math.round(paidAmount) }) ?? payment),
      );
    }
    return errorResponse(409, 'INVALID_STATUS', 'Chỉ chuyển được: Chưa đến hạn → Đã đề nghị → Đã thanh toán.');
  }),
];
