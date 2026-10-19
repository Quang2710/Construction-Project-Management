import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { Task, TaskStatus } from '../models/task.model';
import { KanbanStore } from './kanban.store';

function makeTask(id: string, status: TaskStatus, order: number): Task {
  return {
    id,
    projectId: 'prj-1',
    project: { id: 'prj-1', code: 'HN-01', name: 'Dự án 1' },
    title: `Công việc ${id}`,
    description: '',
    status,
    priority: 'MEDIUM',
    assigneeId: null,
    assignee: null,
    startDate: '2029-12-01',
    dueDate: '2030-01-01',
    wbsId: null,
    dependencyIds: [],
    isMilestone: false,
    percentComplete: status === 'DONE' ? 100 : 20,
    labels: [],
    order,
    commentCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function page<T>(data: T[]): PaginatedResponse<T> {
  return { data, total: data.length, page: 1, pageSize: 500 };
}

describe('KanbanStore', () => {
  let store: InstanceType<typeof KanbanStore>;
  let http: HttpTestingController;
  const notification = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    notification.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        KanbanStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notification },
      ],
    });
    store = TestBed.inject(KanbanStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();

    http.expectOne((req) => req.url === '/api/v1/projects').flush(page([]));
    http
      .expectOne((req) => req.url === '/api/v1/tasks')
      .flush(page([makeTask('a', 'TODO', 1000), makeTask('b', 'TODO', 2000), makeTask('c', 'DONE', 1000)]));
  });

  afterEach(() => http.verify());

  it('nhóm task theo cột và sắp theo order', () => {
    expect(store.columns().TODO.map((task) => task.id)).toEqual(['a', 'b']);
    expect(store.columns().DONE.map((task) => task.id)).toEqual(['c']);
    expect(store.columns().IN_PROGRESS).toEqual([]);
  });

  it('kéo thả: cập nhật ngay trên UI rồi PATCH status + order', async () => {
    const pending = store.moveTask('a', 'DONE', 1);

    // Lạc quan: thẻ đã nằm ở cột DONE, sau thẻ "c", 100%.
    expect(store.columns().DONE.map((task) => task.id)).toEqual(['c', 'a']);
    expect(store.columns().DONE[1].percentComplete).toBe(100);
    expect(store.pendingIds()).toEqual(['a']);

    const request = http.expectOne('/api/v1/tasks/a');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'DONE', order: 2000 });
    request.flush({ ...makeTask('a', 'DONE', 2000), commentCount: 3 });
    await pending;

    expect(store.tasks().find((task) => task.id === 'a')?.commentCount).toBe(3);
    expect(store.pendingIds()).toEqual([]);
  });

  it('kéo thả lỗi: hoàn tác về vị trí cũ và báo lỗi', async () => {
    const pending = store.moveTask('b', 'IN_PROGRESS', 0);
    expect(store.columns().IN_PROGRESS.map((task) => task.id)).toEqual(['b']);

    http
      .expectOne('/api/v1/tasks/b')
      .flush({ code: 'INTERNAL_ERROR', message: 'Máy chủ lỗi' }, { status: 500, statusText: 'Error' });
    await pending;

    expect(store.columns().TODO.map((task) => task.id)).toEqual(['a', 'b']);
    expect(store.columns().IN_PROGRESS).toEqual([]);
    expect(notification.error).toHaveBeenCalledOnce();
  });

  it('kéo thả bị 403: hoàn tác, không báo trùng (interceptor đã báo)', async () => {
    const pending = store.moveTask('a', 'REVIEW', 0);
    http
      .expectOne('/api/v1/tasks/a')
      .flush({ code: 'FORBIDDEN', message: 'Không có quyền' }, { status: 403, statusText: 'Forbidden' });
    await pending;

    expect(store.columns().REVIEW).toEqual([]);
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('lọc nhanh theo từ khoá không dấu', () => {
    store.setSearch('cong viec b');
    expect(store.visibleTasks().map((task) => task.id)).toEqual(['b']);
  });
});
