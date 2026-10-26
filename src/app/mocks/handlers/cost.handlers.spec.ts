import { ChangeOrder, CostEntry, CostSummary, PaymentMilestone, ProfitLossRow } from '../../features/cost/models/cost.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

const PROJECT = 'prj-gthm';

async function summary(token: string, projectId = PROJECT): Promise<CostSummary> {
  return json<CostSummary>(await callApi(`/projects/${projectId}/cost-summary`, { token }));
}

describe('Fake BE: chi phí', () => {
  beforeEach(() => resetMockBackend());

  it('tổng hợp khớp chứng từ, hạng mục và đợt thanh toán', async () => {
    const result = await summary(await tokenFor('pm'));
    const entries = db.costEntries.filter((entry) => entry.projectId === PROJECT);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.actualCost).toBe(entries.reduce((sum, entry) => sum + entry.amount, 0));
    expect(result.actualCost).toBe(result.items.reduce((sum, item) => sum + item.actual, 0));
    expect(result.costBudget).toBe(result.items.reduce((sum, item) => sum + item.budget, 0));
    expect(result.contractValue).toBe(result.originalContract + result.approvedChanges);
    expect(result.receivable).toBe(result.billed - result.received);
    expect(result.profitToDate).toBe(result.earnedRevenue - result.actualCost);
    expect(result.monthly).toHaveLength(12);
  });

  it('CLIENT xem được chi phí nhưng không thấy lãi/lỗ và không ghi được; kỹ sư bị 403', async () => {
    const client = await tokenFor('client');
    const result = await summary(client);
    expect(result).toMatchObject({ profitToDate: null, forecastCost: null, forecastProfit: null, forecastMargin: null });
    expect((await callApi('/cost/overview', { token: client })).status).toBe(403);
    const create = await callApi(`/projects/${PROJECT}/cost-entries`, { method: 'POST', token: client, body: '{}' });
    expect(create.status).toBe(403);

    const engineer = await tokenFor('engineer');
    expect((await callApi(`/projects/${PROJECT}/cost-summary`, { token: engineer })).status).toBe(403);
  });

  it('ghi chi phí: kiểm tra dữ liệu, cộng vào thực tế của hạng mục và dự án', async () => {
    const token = await tokenFor('pm');
    const before = await summary(token);
    const item = before.items[0];
    const valid = { costItemId: item.id, category: 'MATERIAL', date: todayIso(), description: 'Thép D16', vendor: 'Hoà Phát', documentNo: 'HD-01', amount: 150_000_000 };

    const invalid = [
      { ...valid, amount: 0 },
      { ...valid, date: '2999-01-01' },
      { ...valid, description: '  ' },
      { ...valid, category: 'FOOD' },
      { ...valid, costItemId: 'not-an-item' },
    ];
    for (const body of invalid) {
      const response = await callApi(`/projects/${PROJECT}/cost-entries`, { method: 'POST', token, body: JSON.stringify(body) });
      expect(response.status).toBe(422);
    }

    const created = await callApi(`/projects/${PROJECT}/cost-entries`, { method: 'POST', token, body: JSON.stringify(valid) });
    expect(created.status).toBe(201);
    expect(await json<CostEntry>(created)).toMatchObject({ amount: 150_000_000, costItemName: item.name, category: 'MATERIAL' });

    const after = await summary(token);
    expect(after.actualCost).toBe(before.actualCost + 150_000_000);
    expect(after.items[0].actual).toBe(item.actual + 150_000_000);
    expect(db.projects.findById(PROJECT)?.actualCost).toBe(after.actualCost);

    const list = await json<PaginatedResponse<CostEntry>>(
      await callApi(`/projects/${PROJECT}/cost-entries?q=Hoà Phát&category=MATERIAL`, { token }),
    );
    expect(list.data.some((entry) => entry.documentNo === 'HD-01')).toBe(true);
  });

  it('phát sinh: lập → chấp thuận tăng dự toán hạng mục và giá trị hợp đồng; không quyết định lại được', async () => {
    const token = await tokenFor('pm');
    const before = await summary(token);
    const item = before.items[0];
    const created = await json<ChangeOrder>(
      await callApi(`/projects/${PROJECT}/change-orders`, {
        method: 'POST',
        token,
        body: JSON.stringify({ title: 'Bổ sung cọc', description: '', costItemId: item.id, costAmount: 500_000_000, revenueAmount: 650_000_000, date: todayIso() }),
      }),
    );
    expect(created).toMatchObject({ status: 'PROPOSED', costItemName: item.name });
    expect(created.code).toMatch(/^PS-\d{2}$/);

    const approved = await callApi(`/change-orders/${created.id}/approve`, { method: 'POST', token, body: JSON.stringify({ note: 'OK' }) });
    expect(await json<ChangeOrder>(approved)).toMatchObject({ status: 'APPROVED', decisionNote: 'OK' });

    const after = await summary(token);
    expect(after.items[0].budget).toBe(item.budget + 500_000_000);
    expect(after.approvedChanges).toBe(before.approvedChanges + 650_000_000);
    expect(after.contractValue).toBe(before.contractValue + 650_000_000);

    const again = await callApi(`/change-orders/${created.id}/reject`, { method: 'POST', token, body: JSON.stringify({ note: 'x' }) });
    expect(again.status).toBe(409);
  });

  it('không chấp thuận phát sinh bắt buộc có lý do', async () => {
    const token = await tokenFor('pm');
    const proposed = db.changeOrders.findOne((order) => order.status === 'PROPOSED');
    expect(proposed).toBeDefined();
    const noNote = await callApi(`/change-orders/${proposed?.id}/reject`, { method: 'POST', token, body: JSON.stringify({ note: ' ' }) });
    expect(noNote.status).toBe(422);
    const ok = await callApi(`/change-orders/${proposed?.id}/reject`, { method: 'POST', token, body: JSON.stringify({ note: 'Ngoài phạm vi' }) });
    expect(await json<ChangeOrder>(ok)).toMatchObject({ status: 'REJECTED' });
  });

  it('đợt thanh toán: PLANNED → INVOICED → PAID, không nhảy cóc, không thu vượt giá trị', async () => {
    const token = await tokenFor('pm');
    const planned = db.payments.findOne((payment) => payment.status === 'PLANNED');
    expect(planned).toBeDefined();
    const id = planned?.id ?? '';
    const amount = planned?.amount ?? 0;

    const skip = await callApi(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'PAID' }) });
    expect(skip.status).toBe(409);

    const invoiced = await json<PaymentMilestone>(
      await callApi(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'INVOICED' }) }),
    );
    expect(invoiced).toMatchObject({ status: 'INVOICED', invoicedAt: todayIso() });

    const tooMuch = await callApi(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'PAID', paidAmount: amount + 1 }) });
    expect(tooMuch.status).toBe(422);

    const paid = await json<PaymentMilestone>(
      await callApi(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'PAID', paidAmount: amount - 1000 }) }),
    );
    expect(paid).toMatchObject({ status: 'PAID', paidAt: todayIso(), paidAmount: amount - 1000, isOverdue: false });
  });

  it('báo cáo lãi/lỗ: mỗi dự án chưa huỷ một dòng, có đủ chỉ số lãi/lỗ', async () => {
    const rows = await json<ProfitLossRow[]>(await callApi('/cost/overview', { token: await tokenFor('admin') }));
    const expected = db.projects.filter((project) => project.status !== 'CANCELLED').length;
    expect(rows).toHaveLength(expected);
    for (const row of rows) {
      expect(row.profitToDate).toBe(row.earnedRevenue - row.actualCost);
      expect(row.forecastProfit).not.toBeNull();
      expect(row).not.toHaveProperty('items');
    }
  });
});
