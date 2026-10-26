import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/notifications/notification.service';
import { UserRole } from '../../../shared/models/user.model';
import { Project } from '../../projects/models/project.model';
import { CostSummary, PaymentMilestone } from '../models/cost.model';
import { CostStore } from './cost.store';

const PROJECTS = [
  { id: 'prj-cancel', code: 'A', status: 'CANCELLED' },
  { id: 'prj-plan', code: 'B', status: 'PLANNING' },
  { id: 'prj-run', code: 'C', status: 'IN_PROGRESS' },
] as Project[];

function summary(projectId: string, overrun = false): CostSummary {
  return {
    projectId,
    items: [{ id: 'i1', code: '01', name: 'Móng', budget: 100, actual: overrun ? 120 : 50, variance: 0, percentUsed: 0, progress: 0, overrun }],
  } as unknown as CostSummary;
}

const PAYMENT = { id: 'pay-1', name: 'Đợt 2', amount: 1_000, status: 'INVOICED', isOverdue: true } as PaymentMilestone;

const page = <T>(data: T[]) => ({ data, total: data.length, page: 1, pageSize: 15 });

/** Chờ các chuỗi async/await trong store chạy tới request HTTP tiếp theo. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('CostStore', () => {
  let store: InstanceType<typeof CostStore>;
  let http: HttpTestingController;
  const notification = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  /** Trả lời 4 request khi tải một dự án. */
  function flushProject(projectId: string, options: { overrun?: boolean } = {}): void {
    http.expectOne(`/api/v1/projects/${projectId}/cost-summary`).flush(summary(projectId, options.overrun));
    http.expectOne((req) => req.url === `/api/v1/projects/${projectId}/cost-entries`).flush(page([]));
    http.expectOne(`/api/v1/projects/${projectId}/change-orders`).flush([{ id: 'co-1', status: 'PROPOSED' }]);
    http.expectOne(`/api/v1/projects/${projectId}/payments`).flush([PAYMENT]);
  }

  async function setup(role: UserRole): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        CostStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notification },
        { provide: AuthStore, useValue: { hasAnyRole: (roles: readonly UserRole[]) => roles.includes(role) } },
      ],
    });
    store = TestBed.inject(CostStore);
    http = TestBed.inject(HttpTestingController);

    const init = store.init(null);
    http.expectOne((req) => req.url === '/api/v1/projects').flush(page(PROJECTS));
    await settle();
    flushProject('prj-run', { overrun: true });
    await init;
  }

  afterEach(() => {
    http.verify();
    vi.clearAllMocks();
  });

  it('bỏ dự án đã huỷ, mặc định chọn dự án đang thi công và tải đủ dữ liệu', async () => {
    await setup('PROJECT_MANAGER');
    expect(store.projects().map((project) => project.id)).toEqual(['prj-plan', 'prj-run']);
    expect(store.projectId()).toBe('prj-run');
    expect(store.canManage()).toBe(true);
    expect(store.overrunItems()).toHaveLength(1);
    expect(store.pendingChangeOrders()).toHaveLength(1);
    expect(store.overduePayments()).toHaveLength(1);
  });

  it('CLIENT chỉ xem', async () => {
    await setup('CLIENT');
    expect(store.canManage()).toBe(false);
  });

  it('lọc chứng từ: gửi category/q, đổi bộ lọc thì về trang 1', async () => {
    await setup('PROJECT_MANAGER');
    let pending = store.setEntriesFilter({ page: 3 });
    http.expectOne((req) => req.url.endsWith('/cost-entries') && req.params.get('page') === '3').flush(page([]));
    await pending;

    pending = store.setEntriesFilter({ category: 'LABOR', q: ' thép ' });
    const req = http.expectOne((r) => r.url.endsWith('/cost-entries'));
    expect(req.request.params.get('category')).toBe('LABOR');
    expect(req.request.params.get('q')).toBe('thép');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('sort')).toBe('-date');
    req.flush(page([]));
    await pending;
    expect(store.entriesCategory()).toBe('LABOR');
  });

  it('ghi chi phí: POST rồi tải lại tổng hợp và chứng từ', async () => {
    await setup('PROJECT_MANAGER');
    const body = { costItemId: 'i1', category: 'MATERIAL', date: '2026-10-01', description: 'Thép', vendor: '', documentNo: '', amount: 10 } as const;
    const pending = store.addEntry(body);
    const post = http.expectOne((req) => req.url === '/api/v1/projects/prj-run/cost-entries' && req.method === 'POST');
    expect(post.request.body).toEqual(body);
    post.flush({});
    await settle();
    http.expectOne('/api/v1/projects/prj-run/cost-summary').flush(summary('prj-run'));
    http.expectOne((req) => req.url.endsWith('/cost-entries') && req.method === 'GET').flush(page([]));

    await expect(pending).resolves.toBe(true);
    expect(store.overrunItems()).toHaveLength(0);
    expect(notification.success).toHaveBeenCalled();
  });

  it('lỗi 422 khi ghi: báo lỗi tiếng Việt từ BE, không tải lại', async () => {
    await setup('PROJECT_MANAGER');
    const pending = store.addEntry({ costItemId: 'i1', category: 'MATERIAL', date: '2999-01-01', description: 'x', vendor: '', documentNo: '', amount: 1 });
    http
      .expectOne((req) => req.method === 'POST')
      .flush({ code: 'VALIDATION_ERROR', message: 'Ngày chứng từ không hợp lệ.' }, { status: 422, statusText: 'Unprocessable' });
    await expect(pending).resolves.toBe(false);
    expect(notification.error).toHaveBeenCalledWith('Ngày chứng từ không hợp lệ.');
  });

  it('chấp thuận phát sinh: tải lại danh sách phát sinh và tổng hợp (dự toán thay đổi)', async () => {
    await setup('PROJECT_MANAGER');
    const pending = store.decideChangeOrder('co-1', 'approve', 'Đồng ý');
    const post = http.expectOne('/api/v1/change-orders/co-1/approve');
    expect(post.request.body).toEqual({ note: 'Đồng ý' });
    post.flush({});
    await settle();
    http.expectOne('/api/v1/projects/prj-run/change-orders').flush([{ id: 'co-1', status: 'APPROVED' }]);
    http.expectOne('/api/v1/projects/prj-run/cost-summary').flush(summary('prj-run'));
    await expect(pending).resolves.toBe(true);
    expect(store.pendingChangeOrders()).toHaveLength(0);
  });

  it('ghi nhận thu tiền: PATCH status PAID kèm số tiền thực nhận', async () => {
    await setup('PROJECT_MANAGER');
    const pending = store.markPaid(PAYMENT, 900);
    const patch = http.expectOne('/api/v1/payments/pay-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'PAID', paidAmount: 900 });
    patch.flush({});
    await settle();
    http.expectOne('/api/v1/projects/prj-run/payments').flush([{ ...PAYMENT, status: 'PAID', isOverdue: false }]);
    http.expectOne('/api/v1/projects/prj-run/cost-summary').flush(summary('prj-run'));
    await expect(pending).resolves.toBe(true);
    expect(store.overduePayments()).toHaveLength(0);
  });

  it('bỏ kết quả về muộn của dự án cũ khi đã chuyển dự án', async () => {
    await setup('PROJECT_MANAGER');
    const reload = store.loadSummary();
    const stale: TestRequest = http.expectOne('/api/v1/projects/prj-run/cost-summary');

    const switched = store.setProject('prj-plan');
    stale.flush(summary('prj-run', true));
    flushProject('prj-plan');
    await Promise.all([reload, switched]);

    expect(store.summary()?.projectId).toBe('prj-plan');
    expect(store.overrunItems()).toHaveLength(0);
  });
});
