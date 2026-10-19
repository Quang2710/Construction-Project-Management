import { Task } from '../../features/tasks/models/task.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

async function firstTask(token: string, query: string): Promise<Task> {
  const body = await json<PaginatedResponse<Task>>(await callApi(`/tasks?pageSize=1&${query}`, { token }));
  return body.data[0];
}

describe('Fake BE: /tasks', () => {
  beforeEach(() => resetMockBackend());

  it('seed có hơn 100 công việc, mỗi task có dự án và thứ tự Kanban', async () => {
    const body = await json<PaginatedResponse<Task>>(await callApi('/tasks?pageSize=500', { token: await tokenFor('admin') }));
    expect(body.total).toBeGreaterThanOrEqual(100);
    expect(body.data.every((task) => task.project.code !== '—' && task.order > 0)).toBe(true);
  });

  it('SITE_ENGINEER chỉ thấy công việc thuộc dự án được gán', async () => {
    const body = await json<PaginatedResponse<Task>>(
      await callApi('/tasks?pageSize=500', { token: await tokenFor('engineer') }),
    );
    const projectIds = new Set(body.data.map((task) => task.projectId));
    expect([...projectIds].sort()).toEqual(['prj-cvmd', 'prj-gthm', 'prj-sgg']);
  });

  it('PATCH sang DONE tự đặt 100% và lưu thứ tự mới', async () => {
    const token = await tokenFor('engineer');
    const task = await firstTask(token, 'projectId=prj-gthm&status=TODO');
    const response = await callApi(`/tasks/${task.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status: 'DONE', order: 1500 }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'DONE', percentComplete: 100, order: 1500 });
  });

  it('CLIENT không được sửa (403); kỹ sư không sửa được task của dự án không được gán (403)', async () => {
    const admin = await tokenFor('admin');
    const task = await firstTask(admin, 'projectId=prj-gthm');
    const clientPatch = await callApi(`/tasks/${task.id}`, {
      method: 'PATCH',
      token: await tokenFor('client'),
      body: JSON.stringify({ status: 'REVIEW' }),
    });
    expect(clientPatch.status).toBe(403);

    const otherTask = await firstTask(admin, 'projectId=prj-nmqv');
    const engineerPatch = await callApi(`/tasks/${otherTask.id}`, {
      method: 'PATCH',
      token: await tokenFor('engineer'),
      body: JSON.stringify({ status: 'REVIEW' }),
    });
    expect(engineerPatch.status).toBe(403);
  });

  it('PATCH dữ liệu sai trả 422', async () => {
    const token = await tokenFor('pm');
    const task = await firstTask(token, 'projectId=prj-gthm');
    const response = await callApi(`/tasks/${task.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ percentComplete: 150 }),
    });
    expect(response.status).toBe(422);
  });

  it('bình luận: kỹ sư thêm được, CLIENT chỉ đọc', async () => {
    const engineer = await tokenFor('engineer');
    const task = await firstTask(engineer, 'projectId=prj-gthm');

    const created = await callApi(`/tasks/${task.id}/comments`, {
      method: 'POST',
      token: engineer,
      body: JSON.stringify({ content: 'Đã nghiệm thu cốt thép.' }),
    });
    expect(created.status).toBe(201);

    const client = await tokenFor('client');
    const denied = await callApi(`/tasks/${task.id}/comments`, {
      method: 'POST',
      token: client,
      body: JSON.stringify({ content: 'Cho tôi hỏi' }),
    });
    expect(denied.status).toBe(403);

    const list = await json<{ content: string }[]>(await callApi(`/tasks/${task.id}/comments`, { token: client }));
    expect(list.at(-1)?.content).toBe('Đã nghiệm thu cốt thép.');
  });
});
