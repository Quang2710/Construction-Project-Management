import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PhotoUploadService } from '../../../shared/data-access/photo-upload.service';
import { Photo } from '../../../shared/models/photo.model';
import { UserRole, UserSummary } from '../../../shared/models/user.model';
import { Inspection, PunchItem } from '../models/quality.model';
import { InspectionDetailStore } from './inspection-detail.store';

const ENGINEER: UserSummary = { id: 'usr-engineer', fullName: 'Kỹ sư', jobTitle: '', role: 'SITE_ENGINEER' };
const PHOTO = { id: 'f1', url: '/api/v1/files/f1' } as Photo;

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'ins-1',
    code: 'NT-001',
    projectId: 'prj-1',
    project: { id: 'prj-1', code: 'P1', name: 'Dự án', lat: 0, lng: 0 },
    title: 'Nghiệm thu cốt thép',
    location: 'Sàn 5',
    inspectionDate: '2026-10-20',
    status: 'DRAFT',
    currentLevel: null,
    items: [
      { id: 'c1', criterion: 'Đường kính thép', requirement: 'Đúng thiết kế', result: 'PASS', note: '' },
      { id: 'c2', criterion: 'Con kê', requirement: '±5 mm', result: null, note: '' },
    ],
    approvals: [
      { level: 1, label: 'QLDA', decision: null, by: null, at: null, note: '' },
      { level: 2, label: 'QA/QC', decision: null, by: null, at: null, note: '' },
    ],
    history: [],
    createdBy: ENGINEER,
    ...overrides,
  } as Inspection;
}

const page = <T>(data: T[]) => ({ data, total: data.length, page: 1, pageSize: 100 });
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('InspectionDetailStore', () => {
  let store: InstanceType<typeof InspectionDetailStore>;
  let http: HttpTestingController;
  const notification = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const photos = { uploadAll: vi.fn(async () => [PHOTO]) };
  const user = signal<{ id: string; role: UserRole }>({ id: 'usr-engineer', role: 'SITE_ENGINEER' });

  async function load(data: Inspection, punchItems: Partial<PunchItem>[] = []): Promise<void> {
    const pending = store.load(data.id);
    http.expectOne(`/api/v1/inspections/${data.id}`).flush(data);
    await settle();
    http.expectOne((req) => req.url === '/api/v1/punch-items').flush(page(punchItems));
    await pending;
    http.expectOne('/api/v1/projects/prj-1/members').flush([ENGINEER]);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InspectionDetailStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notification },
        { provide: PhotoUploadService, useValue: photos },
        {
          provide: AuthStore,
          useValue: {
            user,
            role: () => user().role,
            hasAnyRole: (roles: readonly UserRole[]) => roles.includes(user().role),
          },
        },
      ],
    });
    store = TestBed.inject(InspectionDetailStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.clearAllMocks();
  });

  it('người lập sửa được bản nháp; đánh dấu Đạt các mục còn lại', async () => {
    await load(inspection());
    expect(store.canEdit()).toBe(true);
    expect(store.canDecide()).toBe(false);
    expect(store.pendingCount()).toBe(1);
    store.passRemaining();
    expect(store.pendingCount()).toBe(0);
    expect(store.dirty()).toBe(true);
  });

  it('gửi duyệt: lưu checklist trước khi submit nếu có thay đổi', async () => {
    await load(inspection());
    store.setResult(1, 'FAIL');
    store.setNote(1, 'Thiếu con kê ô sàn S3');
    const pending = store.submit({ title: 'Nghiệm thu cốt thép', location: 'Sàn 5', inspectionDate: '2026-10-20' });

    const put = http.expectOne((req) => req.method === 'PUT');
    expect(put.request.body.items[1]).toMatchObject({ id: 'c2', result: 'FAIL', note: 'Thiếu con kê ô sàn S3' });
    put.flush(inspection({ items: put.request.body.items }));
    await settle();
    http.expectOne('/api/v1/inspections/ins-1/submit').flush(inspection({ status: 'IN_REVIEW', currentLevel: 1 }));

    await expect(pending).resolves.toBe(true);
    expect(store.inspection()?.status).toBe('IN_REVIEW');
    expect(store.dirty()).toBe(false);
    expect(store.canEdit()).toBe(false);
  });

  it('PM duyệt được cấp 1 phiếu người khác lập; bị chặn khi còn tiêu chí không đạt / punch mở', async () => {
    user.set({ id: 'usr-pm', role: 'PROJECT_MANAGER' });
    const items = inspection().items.map((item) => ({ ...item, result: 'PASS' as const }));
    await load(inspection({ status: 'IN_REVIEW', currentLevel: 1, items }), [{ id: 'p1', status: 'RESOLVED', checklistItemId: 'c2' }]);

    expect(store.canDecide()).toBe(true);
    expect(store.approvalBlocker()).toContain('1 lỗi');
    expect(store.punchByItem().get('c2')).toHaveLength(1);
  });

  it('không được duyệt: cấp hiện tại không đúng role, hoặc tự duyệt phiếu mình lập', async () => {
    user.set({ id: 'usr-pm', role: 'PROJECT_MANAGER' });
    await load(inspection({ status: 'IN_REVIEW', currentLevel: 2 }));
    expect(store.canDecide()).toBe(false);

    user.set({ id: 'usr-engineer', role: 'PROJECT_MANAGER' });
    await load(inspection({ status: 'IN_REVIEW', currentLevel: 1 }));
    expect(store.canDecide()).toBe(false);
  });

  it('ghi nhận lỗi từ tiêu chí không đạt: tải ảnh rồi tạo punch gắn với phiếu', async () => {
    await load(inspection());
    const draft = {
      inspectionId: null,
      checklistItemId: 'c2',
      title: 'Con kê không đạt',
      description: '',
      location: 'Sàn 5',
      severity: 'HIGH' as const,
      assigneeId: 'usr-engineer',
      dueDate: '2026-10-30',
    };
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const pending = store.createPunch(draft, [file]);
    await settle();

    expect(photos.uploadAll).toHaveBeenCalledWith([file], 'Hiện trạng: Con kê không đạt');
    const post = http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/punch-items');
    expect(post.request.body).toMatchObject({ projectId: 'prj-1', inspectionId: 'ins-1', checklistItemId: 'c2', beforePhotos: [PHOTO] });
    post.flush({ id: 'p9', code: 'PL-009' });
    await settle();
    http.expectOne((req) => req.url === '/api/v1/punch-items' && req.method === 'GET').flush(page([{ id: 'p9', status: 'OPEN', checklistItemId: 'c2' }]));

    await expect(pending).resolves.toBe(true);
    expect(store.openPunchCount()).toBe(1);
  });
});
