import { Inspection, PunchItem } from '../../features/quality/models/quality.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { Photo } from '../../shared/models/photo.model';
import { addDays } from 'date-fns';
import { todayIso, toIsoDate } from '../../shared/utils/date.utils';
import { db } from '../db';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

/** Dự án demo: PM demo quản lý, kỹ sư demo là thành viên. */
const PROJECT = 'prj-gthm';

function post(path: string, token: string, body: unknown = {}): Promise<Response> {
  return callApi(path, { method: 'POST', token, body: JSON.stringify(body) });
}

async function uploadPhoto(token: string): Promise<Photo> {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'loi.jpg', { type: 'image/jpeg' }));
  const uploaded = await json<{ id: string; url: string; fileName: string; mimeType: string; size: number }>(
    await callApi('/uploads', { method: 'POST', token, body: form }),
  );
  return { ...uploaded, caption: '', takenAt: new Date().toISOString(), location: null };
}

async function createInspection(token: string): Promise<Inspection> {
  const wbs = db.wbs.filter((node) => node.projectId === PROJECT);
  const leaf = wbs.find((node) => !wbs.some((child) => child.parentId === node.id));
  return json<Inspection>(
    await post('/inspections', token, {
      projectId: PROJECT,
      wbsId: leaf?.id,
      templateId: 'tpl-rebar',
      title: 'Nghiệm thu cốt thép sàn tầng 9',
      location: 'Sàn tầng 9',
      inspectionDate: todayIso(),
    }),
  );
}

function fillChecklist(inspection: Inspection, result: 'PASS' | 'FAIL' = 'PASS') {
  return {
    title: inspection.title,
    location: inspection.location,
    inspectionDate: inspection.inspectionDate,
    items: inspection.items.map((item, index) => ({ ...item, result: index === 0 ? result : 'PASS' })),
  };
}

describe('Fake BE: chất lượng', () => {
  beforeEach(() => resetMockBackend());

  it('seed có đủ trạng thái phiếu và punch list, ảnh seed phục vụ được', async () => {
    const pm = await tokenFor('pm');
    const list = await json<PaginatedResponse<Inspection>>(await callApi(`/inspections?projectId=${PROJECT}&pageSize=50`, { token: pm }));
    const statuses = new Set(list.data.map((item) => item.status));
    expect(statuses).toEqual(new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED']));
    expect(list.data.some((item) => item.status === 'IN_REVIEW' && item.currentLevel === 2)).toBe(true);

    const rejected = list.data.find((item) => item.status === 'REJECTED');
    expect(rejected?.stats.fail).toBeGreaterThan(0);
    expect(rejected?.stats.openPunchItems).toBeGreaterThan(0);

    const punch = db.punchItems.findOne((item) => item.projectId === PROJECT);
    const photo = await callApi(`/files/${punch?.beforePhotos[0].id}`);
    expect(photo.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('duyệt 2 cấp: kỹ sư lập → PM duyệt cấp 1 → QA/QC (admin) duyệt cấp 2', async () => {
    const engineer = await tokenFor('engineer');
    const pm = await tokenFor('pm');
    const admin = await tokenFor('admin');
    const created = await createInspection(engineer);
    expect(created).toMatchObject({ status: 'DRAFT', currentLevel: null });
    expect(created.items.length).toBeGreaterThan(0);

    // Chưa đánh giá hết tiêu chí thì không gửi được.
    expect((await post(`/inspections/${created.id}/submit`, engineer)).status).toBe(422);

    await callApi(`/inspections/${created.id}`, { method: 'PUT', token: engineer, body: JSON.stringify(fillChecklist(created)) });
    const submitted = await json<Inspection>(await post(`/inspections/${created.id}/submit`, engineer));
    expect(submitted).toMatchObject({ status: 'IN_REVIEW', currentLevel: 1 });

    // Kỹ sư không duyệt được; admin chưa tới lượt cấp 2 nhưng có quyền cấp 1.
    expect((await post(`/inspections/${created.id}/approve`, engineer)).status).toBe(403);
    const awaiting = await json<PaginatedResponse<Inspection>>(await callApi('/inspections?awaitingMe=true&pageSize=100', { token: pm }));
    expect(awaiting.data.map((item) => item.id)).toContain(created.id);

    const level1 = await json<Inspection>(await post(`/inspections/${created.id}/approve`, pm, { note: 'Đạt' }));
    expect(level1).toMatchObject({ status: 'IN_REVIEW', currentLevel: 2 });
    expect(level1.approvals[0]).toMatchObject({ decision: 'APPROVED', note: 'Đạt' });

    // PM không có quyền cấp QA/QC.
    expect((await post(`/inspections/${created.id}/approve`, pm)).status).toBe(403);
    const done = await json<Inspection>(await post(`/inspections/${created.id}/approve`, admin));
    expect(done).toMatchObject({ status: 'APPROVED', currentLevel: null });
    expect(done.history.map((entry) => entry.action)).toEqual(['CREATED', 'SUBMITTED', 'APPROVED', 'APPROVED']);

    // Đã nghiệm thu thì khoá.
    const edit = await callApi(`/inspections/${created.id}`, { method: 'PUT', token: engineer, body: JSON.stringify(fillChecklist(created)) });
    expect(edit.status).toBe(409);
  });

  it('không tự duyệt phiếu mình lập; một người không duyệt 2 cấp', async () => {
    const admin = await tokenFor('admin');
    const pm = await tokenFor('pm');
    const own = await createInspection(pm);
    await callApi(`/inspections/${own.id}`, { method: 'PUT', token: pm, body: JSON.stringify(fillChecklist(own)) });
    await post(`/inspections/${own.id}/submit`, pm);
    expect(await json(await post(`/inspections/${own.id}/approve`, pm))).toMatchObject({ code: 'SELF_APPROVAL' });

    // Admin duyệt cấp 1 rồi không được duyệt tiếp cấp 2.
    await post(`/inspections/${own.id}/approve`, admin);
    expect(await json(await post(`/inspections/${own.id}/approve`, admin))).toMatchObject({ code: 'ALREADY_APPROVED' });
  });

  it('còn tiêu chí không đạt hoặc punch item mở thì không duyệt được; trả lại cần lý do; gửi lại bắt đầu từ cấp 1', async () => {
    const engineer = await tokenFor('engineer');
    const pm = await tokenFor('pm');
    const created = await createInspection(engineer);
    await callApi(`/inspections/${created.id}`, { method: 'PUT', token: engineer, body: JSON.stringify(fillChecklist(created, 'FAIL')) });
    await post(`/inspections/${created.id}/submit`, engineer);

    expect(await json(await post(`/inspections/${created.id}/approve`, pm))).toMatchObject({ code: 'HAS_FAILED_ITEMS' });
    expect((await post(`/inspections/${created.id}/reject`, pm, { note: '' })).status).toBe(422);
    const rejected = await json<Inspection>(await post(`/inspections/${created.id}/reject`, pm, { note: 'Thiếu con kê' }));
    expect(rejected).toMatchObject({ status: 'REJECTED', currentLevel: null });

    // Ghi punch item từ tiêu chí không đạt, khắc phục xong mới duyệt được.
    const punch = await json<PunchItem>(
      await post('/punch-items', engineer, {
        projectId: PROJECT,
        inspectionId: created.id,
        checklistItemId: created.items[0].id,
        title: 'Thiếu con kê',
        description: '',
        location: 'Sàn tầng 9',
        severity: 'HIGH',
        assigneeId: 'usr-engineer',
        dueDate: todayIso(),
        beforePhotos: [await uploadPhoto(engineer)],
      }),
    );
    expect(punch).toMatchObject({ status: 'OPEN', inspectionCode: created.code });

    await callApi(`/inspections/${created.id}`, { method: 'PUT', token: engineer, body: JSON.stringify(fillChecklist(created)) });
    const resubmitted = await json<Inspection>(await post(`/inspections/${created.id}/submit`, engineer));
    expect(resubmitted.approvals.every((approval) => approval.decision === null)).toBe(true);
    expect(await json(await post(`/inspections/${created.id}/approve`, pm))).toMatchObject({ code: 'OPEN_PUNCH_ITEMS' });
  });

  it('punch list: mới → đang xử lý → chờ xác nhận (bắt buộc ảnh sau) → đóng; người khắc phục không tự đóng', async () => {
    const engineer = await tokenFor('engineer');
    const pm = await tokenFor('pm');
    const base = {
      projectId: PROJECT,
      inspectionId: null,
      checklistItemId: null,
      title: 'Rò rỉ ống cấp nước',
      description: 'Mối nối ren',
      location: 'WC tầng 3',
      severity: 'HIGH',
      assigneeId: 'usr-engineer',
      dueDate: toIsoDate(addDays(new Date(), 3)),
    };
    expect((await post('/punch-items', engineer, { ...base, beforePhotos: [] })).status).toBe(422);
    expect((await post('/punch-items', engineer, { ...base, assigneeId: 'usr-client', beforePhotos: [await uploadPhoto(engineer)] })).status).toBe(422);
    const created = await json<PunchItem>(await post('/punch-items', engineer, { ...base, beforePhotos: [await uploadPhoto(engineer)] }));
    expect(created.code).toMatch(/^PL-\d{3}$/);

    expect(await json<PunchItem>(await post(`/punch-items/${created.id}/start`, engineer))).toMatchObject({ status: 'IN_PROGRESS' });
    expect(await json(await post(`/punch-items/${created.id}/resolve`, engineer, { note: 'Xong' }))).toMatchObject({ code: 'AFTER_PHOTO_REQUIRED' });
    const resolved = await json<PunchItem>(
      await post(`/punch-items/${created.id}/resolve`, engineer, { note: 'Đã thay mối nối', afterPhotos: [await uploadPhoto(engineer)] }),
    );
    expect(resolved).toMatchObject({ status: 'RESOLVED' });
    expect(resolved.afterPhotos).toHaveLength(1);

    expect((await post(`/punch-items/${created.id}/verify`, engineer)).status).toBe(403);
    expect((await post(`/punch-items/${created.id}/reopen`, pm, { note: '' })).status).toBe(422);
    const reopened = await json<PunchItem>(await post(`/punch-items/${created.id}/reopen`, pm, { note: 'Vẫn còn rò' }));
    expect(reopened.status).toBe('OPEN');

    await post(`/punch-items/${created.id}/resolve`, engineer, { note: 'Lần 2', afterPhotos: [await uploadPhoto(engineer)] });
    const verified = await json<PunchItem>(await post(`/punch-items/${created.id}/verify`, pm));
    expect(verified).toMatchObject({ status: 'VERIFIED', isOverdue: false });
    expect(verified.history.map((entry) => entry.action)).toEqual(['CREATED', 'STARTED', 'RESOLVED', 'REOPENED', 'RESOLVED', 'VERIFIED']);
  });

  it('lọc punch list: của tôi, quá hạn; CLIENT chỉ thấy phiếu đã nghiệm thu và không ghi được', async () => {
    const engineer = await tokenFor('engineer');
    const mine = await json<PaginatedResponse<PunchItem>>(await callApi('/punch-items?assigneeId=me&pageSize=200', { token: engineer }));
    expect(mine.data.every((item) => item.assignee?.id === 'usr-engineer')).toBe(true);
    const overdue = await json<PaginatedResponse<PunchItem>>(await callApi('/punch-items?overdue=true&pageSize=200', { token: engineer }));
    expect(overdue.data.length).toBeGreaterThan(0);
    expect(overdue.data.every((item) => item.isOverdue && item.dueDate < todayIso())).toBe(true);

    const client = await tokenFor('client');
    const inspections = await json<PaginatedResponse<Inspection>>(await callApi('/inspections?pageSize=200', { token: client }));
    expect(inspections.data.every((item) => item.status === 'APPROVED')).toBe(true);
    expect((await post('/punch-items', client, {})).status).toBe(403);
    expect((await post('/inspections', client, {})).status).toBe(403);
  });
});
