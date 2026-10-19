import { WbsNode } from '../../features/scheduling/models/wbs.model';
import { Task } from '../../features/tasks/models/task.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { db } from '../db';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

async function projectTasks(token: string, projectId: string): Promise<Task[]> {
  return (await json<PaginatedResponse<Task>>(await callApi(`/tasks?projectId=${projectId}&pageSize=500`, { token }))).data;
}

describe('Fake BE: lập tiến độ (WBS, phụ thuộc, mốc)', () => {
  beforeEach(() => resetMockBackend());

  it('WBS nhiều cấp có mã theo vị trí; mọi công việc thuộc một hạng mục', async () => {
    const token = await tokenFor('pm');
    const wbs = await json<WbsNode[]>(await callApi('/projects/prj-gthm/wbs', { token }));
    expect(wbs.map((node) => node.code)).toEqual(['1', '2', '3', '3.1', '3.2', '4', '5']);
    expect(wbs.find((node) => node.code === '3.1')?.name).toBe('Kết cấu');

    const tasks = await projectTasks(token, 'prj-gthm');
    const ids = new Set(wbs.map((node) => node.id));
    expect(tasks.every((task) => task.wbsId !== null && ids.has(task.wbsId))).toBe(true);
    expect(tasks.filter((task) => task.isMilestone).every((task) => task.startDate === task.dueDate)).toBe(true);
  });

  it('seed tôn trọng FS: không công việc nào bắt đầu trước khi công việc trước xong', async () => {
    const tasks = db.tasks.all();
    const byId = new Map(tasks.map((task) => [task.id, task]));
    for (const task of tasks) {
      for (const dependencyId of task.dependencyIds) {
        expect(task.startDate >= (byId.get(dependencyId)?.dueDate ?? '')).toBe(true);
      }
    }
  });

  it('dời ngày vi phạm phụ thuộc → 422 DEPENDENCY_VIOLATION', async () => {
    const token = await tokenFor('pm');
    const permit = db.tasks.findById('tsk-hn-gthm-permit');
    const response = await callApi('/tasks/tsk-hn-gthm-permit', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ startDate: '2000-01-01', dueDate: permit?.dueDate }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'DEPENDENCY_VIOLATION' });
  });

  it('kéo dài công việc trước thì các công việc sau được dời theo (giữ thời lượng)', async () => {
    const token = await tokenFor('engineer');
    const before = db.tasks.findById('tsk-hn-gthm-excavation');
    const footingBefore = db.tasks.findById('tsk-hn-gthm-footing');
    expect(before && footingBefore).toBeTruthy();
    const newDue = '2099-01-10';
    const response = await callApi('/tasks/tsk-hn-gthm-excavation', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ dueDate: newDue }),
    });
    expect(response.status).toBe(200);
    const footing = db.tasks.findById('tsk-hn-gthm-footing');
    expect(footing?.startDate).toBe(newDue);
    const days = (iso: string) => new Date(iso).getTime() / 86_400_000;
    expect(days(footing?.dueDate ?? '') - days(footing?.startDate ?? '')).toBe(
      days(footingBefore?.dueDate ?? '') - days(footingBefore?.startDate ?? ''),
    );
    // Dời dây chuyền tới tận mốc bàn giao.
    expect((db.tasks.findById('tsk-hn-gthm-ms-handover')?.startDate ?? '') > newDue).toBe(true);
  });

  it('thêm phụ thuộc tạo vòng lặp → 409; thêm hợp lệ → 200', async () => {
    const token = await tokenFor('pm');
    const cycle = await callApi('/tasks/tsk-hn-gthm-survey', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ dependencyIds: ['tsk-hn-gthm-ms-handover'] }),
    });
    expect(cycle.status).toBe(409);

    const plumbing = db.tasks.findById('tsk-hn-gthm-plumbing');
    const ok = await callApi('/tasks/tsk-hn-gthm-plumbing', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ dependencyIds: [...(plumbing?.dependencyIds ?? []), 'tsk-hn-gthm-survey'] }),
    });
    expect(ok.status).toBe(200);
  });

  it('phụ thuộc khác dự án → 422; đặt mốc thì hạn = ngày bắt đầu', async () => {
    const token = await tokenFor('admin');
    const crossProject = await callApi('/tasks/tsk-hn-gthm-plumbing', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ dependencyIds: ['tsk-hn-cvmd-survey'] }),
    });
    expect(crossProject.status).toBe(422);

    const task = await json<Task>(
      await callApi('/tasks/tsk-hn-gthm-fire-check', { method: 'PATCH', token, body: JSON.stringify({ isMilestone: true }) }),
    );
    expect(task.isMilestone).toBe(true);
    expect(task.dueDate).toBe(task.startDate);
  });

  it('thêm hạng mục WBS con (PM) và CLIENT bị 403', async () => {
    const pm = await tokenFor('pm');
    const created = await callApi('/projects/prj-gthm/wbs', {
      method: 'POST',
      token: pm,
      body: JSON.stringify({ name: 'Cảnh quan', parentId: 'wbs-hn-gthm-5' }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ code: '5.1', name: 'Cảnh quan' });

    const client = await callApi('/projects/prj-gthm/wbs', {
      method: 'POST',
      token: await tokenFor('client'),
      body: JSON.stringify({ name: 'X', parentId: null }),
    });
    expect(client.status).toBe(403);
  });
});
