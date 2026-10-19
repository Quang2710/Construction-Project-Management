import { Project, ProjectUpsertRequest } from '../../features/projects/models/project.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

const NEW_PROJECT: ProjectUpsertRequest = {
  code: 'DN-TEST',
  name: 'Nhà văn hoá thử nghiệm',
  description: '',
  clientName: 'UBND phường Hải Châu',
  location: { address: '1 Bạch Đằng', province: 'TP. Đà Nẵng', lat: 16.07, lng: 108.22 },
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  budget: 25_000_000_000,
  status: 'PLANNING',
  managerId: 'usr-pm',
  memberIds: ['usr-engineer'],
};

describe('Fake BE: /projects', () => {
  beforeEach(() => resetMockBackend());

  it('seed có 8 dự án với tiến độ, cảnh báo được tính sẵn', async () => {
    const response = await callApi('/projects?pageSize=50', { token: await tokenFor('pm') });
    const body = await json<PaginatedResponse<Project>>(response);
    expect(body.total).toBe(8);
    expect(body.data.some((project) => project.isDelayed)).toBe(true);
    expect(body.data.some((project) => project.isOverBudget)).toBe(true);
    expect(body.data.every((project) => project.taskStats.total > 0)).toBe(true);
  });

  it('SITE_ENGINEER chỉ thấy dự án được gán và bị 403 với dự án khác', async () => {
    const token = await tokenFor('engineer');
    const body = await json<PaginatedResponse<Project>>(await callApi('/projects?pageSize=50', { token }));
    expect(body.total).toBe(3);
    expect(body.data.every((project) => project.memberIds.includes('usr-engineer'))).toBe(true);

    expect((await callApi('/projects/prj-nmqv', { token })).status).toBe(403);
    expect((await callApi('/projects/prj-gthm', { token })).status).toBe(200);
  });

  it('lọc theo trạng thái và tìm kiếm không dấu', async () => {
    const token = await tokenFor('admin');
    const byStatus = await json<PaginatedResponse<Project>>(await callApi('/projects?status=COMPLETED', { token }));
    expect(byStatus.data.map((project) => project.code)).toEqual(['DN-THHX']);

    const bySearch = await json<PaginatedResponse<Project>>(await callApi('/projects?q=cau vuot', { token }));
    expect(bySearch.data.map((project) => project.code)).toEqual(['HN-CVMD']);
  });

  it('CLIENT và SITE_ENGINEER không được tạo dự án (403)', async () => {
    for (const role of ['client', 'engineer'] as const) {
      const response = await callApi('/projects', {
        method: 'POST',
        token: await tokenFor(role),
        body: JSON.stringify(NEW_PROJECT),
      });
      expect(response.status).toBe(403);
    }
  });

  it('PM tạo dự án hợp lệ (201), trùng mã trả 409, dữ liệu sai trả 422', async () => {
    const token = await tokenFor('pm');
    const created = await callApi('/projects', { method: 'POST', token, body: JSON.stringify(NEW_PROJECT) });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ code: 'DN-TEST', progress: 0 });

    const duplicate = await callApi('/projects', { method: 'POST', token, body: JSON.stringify(NEW_PROJECT) });
    expect(duplicate.status).toBe(409);

    const invalid = await callApi('/projects', {
      method: 'POST',
      token,
      body: JSON.stringify({ ...NEW_PROJECT, code: 'DN-OTHER', endDate: '2025-01-01' }),
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
  });

  it('xoá dự án xoá luôn công việc của dự án', async () => {
    const token = await tokenFor('admin');
    expect((await callApi('/projects/prj-thhx', { method: 'DELETE', token })).status).toBe(204);
    const tasks = await json<PaginatedResponse<unknown>>(await callApi('/tasks?projectId=prj-thhx', { token }));
    expect(tasks.total).toBe(0);
  });
});
