import { Material, MaterialRequest, StockItem, StockTransaction } from '../../features/materials/models/material.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { db } from '../db';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

describe('Fake BE: vật tư & kho', () => {
  beforeEach(() => resetMockBackend());

  it('tồn kho khớp lịch sử nhập/xuất; có vật tư dưới mức tối thiểu', async () => {
    for (const record of db.stock.all()) {
      const txs = db.stockTransactions.filter((tx) => tx.projectId === record.projectId && tx.materialId === record.materialId);
      const balance = txs.reduce((sum, tx) => sum + (tx.type === 'IN' ? tx.quantity : -tx.quantity), 0);
      expect(balance).toBe(record.quantity);
    }
    const low = await json<StockItem[]>(await callApi('/stock?lowOnly=true', { token: await tokenFor('pm') }));
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((item) => item.isLow && item.quantity < item.minQuantity)).toBe(true);
  });

  it('CLIENT không truy cập được kho; kỹ sư chỉ thấy công trường được gán', async () => {
    expect((await callApi('/materials', { token: await tokenFor('client') })).status).toBe(403);
    const engineer = await tokenFor('engineer');
    const stock = await json<StockItem[]>(await callApi('/stock', { token: engineer }));
    expect(new Set(stock.map((item) => item.projectId))).toEqual(new Set(['prj-gthm', 'prj-cvmd', 'prj-sgg']));
    expect((await callApi('/stock?projectId=prj-nmqv', { token: engineer })).status).toBe(403);
  });

  it('xuất kho vượt tồn → 422; xuất hợp lệ giảm tồn', async () => {
    const token = await tokenFor('engineer');
    const record = db.stock.findOne((item) => item.projectId === 'prj-gthm' && item.quantity > 10);
    expect(record).toBeDefined();
    const tooMuch = await callApi('/stock-transactions', {
      method: 'POST',
      token,
      body: JSON.stringify({ projectId: 'prj-gthm', materialId: record?.materialId, type: 'OUT', quantity: (record?.quantity ?? 0) + 1, note: '' }),
    });
    expect(tooMuch.status).toBe(422);
    expect(await tooMuch.json()).toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    const ok = await json<StockTransaction>(
      await callApi('/stock-transactions', {
        method: 'POST',
        token,
        body: JSON.stringify({ projectId: 'prj-gthm', materialId: record?.materialId, type: 'OUT', quantity: 5, note: 'Xuất thử' }),
      }),
    );
    expect(ok).toMatchObject({ type: 'OUT', quantity: 5, balanceAfter: (record?.quantity ?? 0) - 5 });
    expect(db.stock.findById(record?.id ?? '')?.quantity).toBe((record?.quantity ?? 0) - 5);
  });

  it('phiếu yêu cầu: kỹ sư lập → kỹ sư không tự duyệt → PM duyệt → nhập kho tăng tồn', async () => {
    const engineer = await tokenFor('engineer');
    const pm = await tokenFor('pm');
    const before = db.stock.findById('prj-gthm:mat-xm-pcb40')?.quantity ?? 0;
    const created = await json<MaterialRequest>(
      await callApi('/material-requests', {
        method: 'POST',
        token: engineer,
        body: JSON.stringify({
          projectId: 'prj-gthm',
          items: [{ materialId: 'mat-xm-pcb40', quantity: 200 }],
          neededBy: '2030-01-01',
          note: 'Đổ sàn tầng 15',
        }),
      }),
    );
    expect(created).toMatchObject({ status: 'PENDING', totalValue: 200 * 92_000 });

    expect((await callApi(`/material-requests/${created.id}/approve`, { method: 'POST', token: engineer })).status).toBe(403);
    // Chưa duyệt thì chưa nhập kho được.
    expect((await callApi(`/material-requests/${created.id}/receive`, { method: 'POST', token: engineer })).status).toBe(409);

    const approved = await json<MaterialRequest>(await callApi(`/material-requests/${created.id}/approve`, { method: 'POST', token: pm }));
    expect(approved.status).toBe('APPROVED');
    const received = await json<MaterialRequest>(await callApi(`/material-requests/${created.id}/receive`, { method: 'POST', token: engineer }));
    expect(received.status).toBe('RECEIVED');
    expect(received.history.map((entry) => entry.action)).toEqual(['CREATED', 'APPROVED', 'RECEIVED']);
    expect(db.stock.findById('prj-gthm:mat-xm-pcb40')?.quantity).toBe(before + 200);
    expect(db.stockTransactions.filter((tx) => tx.requestId === created.id)).toHaveLength(1);
  });

  it('từ chối cần lý do; dòng vật tư lặp → 422', async () => {
    const pm = await tokenFor('pm');
    const pending = db.materialRequests.findOne((item) => item.status === 'PENDING');
    expect((await callApi(`/material-requests/${pending?.id}/reject`, { method: 'POST', token: pm })).status).toBe(422);
    const duplicate = await callApi('/material-requests', {
      method: 'POST',
      token: pm,
      body: JSON.stringify({
        projectId: 'prj-gthm',
        items: [
          { materialId: 'mat-xm-pcb40', quantity: 1 },
          { materialId: 'mat-xm-pcb40', quantity: 2 },
        ],
        neededBy: '2030-01-01',
      }),
    });
    expect(duplicate.status).toBe(422);
  });

  it('tra cứu theo mã QR; danh mục: trùng mã → 409, kỹ sư không được sửa', async () => {
    const token = await tokenFor('engineer');
    expect(await json<Material>(await callApi('/materials/by-code/th-cb400-d16', { token }))).toMatchObject({ id: 'mat-thep-d16' });
    expect((await callApi('/materials/by-code/KHONG-CO', { token })).status).toBe(404);

    const body = { code: 'XM-PCB40', name: 'Trùng', unit: 'bao', category: 'CEMENT', unitPrice: 1, description: '' };
    expect((await callApi('/materials', { method: 'POST', token: await tokenFor('pm'), body: JSON.stringify(body) })).status).toBe(409);
    expect((await callApi('/materials', { method: 'POST', token, body: JSON.stringify({ ...body, code: 'MOI-01' }) })).status).toBe(403);

    const list = await json<PaginatedResponse<Material>>(await callApi('/materials?category=STEEL&pageSize=50', { token }));
    expect(list.data.every((material) => material.category === 'STEEL')).toBe(true);
  });
});
