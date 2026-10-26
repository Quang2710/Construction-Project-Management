import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/notifications/notification.service';
import { UserRole, UserSummary } from '../../../shared/models/user.model';
import { Drawing, DrawingRevision } from '../models/document.model';
import { DrawingDetailStore } from './drawing-detail.store';

const USER: UserSummary = { id: 'u1', fullName: 'PM', jobTitle: '', role: 'PROJECT_MANAGER' };

function revision(label: string): DrawingRevision {
  return {
    id: `r${label}`,
    revision: label,
    description: `Rev ${label}`,
    file: { fileId: `f${label}`, url: `/api/v1/files/f${label}`, fileName: `KT-101_${label}.pdf`, size: 1000 },
    issuedAt: '2026-01-01T00:00:00.000Z',
    uploadedBy: USER,
  };
}

function drawing(labels: readonly string[]): Drawing {
  const revisions = labels.map(revision);
  return {
    id: 'drw-1',
    projectId: 'prj-1',
    projectCode: 'P1',
    code: 'KT-101',
    title: 'Mặt bằng',
    discipline: 'ARCH',
    revisions,
    currentRevision: revisions[revisions.length - 1],
    updatedAt: '',
  };
}

const bytes = (value: number) => new Uint8Array([value]).buffer;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('DrawingDetailStore', () => {
  let store: InstanceType<typeof DrawingDetailStore>;
  let http: HttpTestingController;
  const notification = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DrawingDetailStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notification },
        { provide: AuthStore, useValue: { hasAnyRole: (roles: readonly UserRole[]) => roles.includes('PROJECT_MANAGER') } },
      ],
    });
    store = TestBed.inject(DrawingDetailStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.clearAllMocks();
  });

  it('mặc định xem phiên bản mới nhất và tải PDF của nó', async () => {
    const pending = store.load('drw-1', null, null);
    http.expectOne('/api/v1/drawings/drw-1').flush(drawing(['A', 'B', 'C']));
    await settle();
    const file = http.expectOne('/api/v1/files/fC');
    expect(file.request.responseType).toBe('arraybuffer');
    file.flush(bytes(3));
    await pending;

    expect(store.revision()?.revision).toBe('C');
    expect(store.isLatest()).toBe(true);
    expect(store.revisionsDesc().map((item) => item.revision)).toEqual(['C', 'B', 'A']);
    expect(store.viewData()).not.toBeNull();
    expect(store.canManage()).toBe(true);
  });

  it('?rev=A&compare=C: cặp so sánh luôn theo thứ tự cũ → mới', async () => {
    const pending = store.load('drw-1', 'C', 'A');
    http.expectOne('/api/v1/drawings/drw-1').flush(drawing(['A', 'B', 'C']));
    await settle();
    http.expectOne('/api/v1/files/fC').flush(bytes(3));
    http.expectOne('/api/v1/files/fA').flush(bytes(1));
    await pending;

    expect(store.comparePair()).toMatchObject({ older: { revision: 'A' }, newer: { revision: 'C' } });
  });

  it('bật so sánh mặc định với phiên bản liền trước; không tải lại PDF đã có', async () => {
    const pending = store.load('drw-1', 'B', null);
    http.expectOne('/api/v1/drawings/drw-1').flush(drawing(['A', 'B', 'C']));
    await settle();
    http.expectOne('/api/v1/files/fB').flush(bytes(2));
    await pending;
    expect(store.isLatest()).toBe(false);

    const compare = store.startCompare();
    http.expectOne('/api/v1/files/fA').flush(bytes(1));
    await compare;
    expect(store.compareRevision()?.revision).toBe('A');

    // Chọn lại B (đã có trong bộ nhớ đệm): không có request mới.
    await store.selectRevision('rB');
    store.stopCompare();
    expect(store.comparePair()).toBeNull();
  });

  it('phát hành phiên bản mới: tải PDF lên, tạo revision, chuyển sang xem bản mới', async () => {
    const pending = store.load('drw-1', null, null);
    http.expectOne('/api/v1/drawings/drw-1').flush(drawing(['A']));
    await settle();
    http.expectOne('/api/v1/files/fA').flush(bytes(1));
    await pending;

    const file = new File(['%PDF'], 'KT-101_B.pdf', { type: 'application/pdf' });
    const adding = store.addRevision('Dời vách ngăn', file);
    http.expectOne('/api/v1/uploads').flush({ id: 'fB', url: '/api/v1/files/fB', fileName: 'KT-101_B.pdf', mimeType: 'application/pdf', size: 4 });
    await settle();
    const post = http.expectOne('/api/v1/drawings/drw-1/revisions');
    expect(post.request.body).toEqual({
      description: 'Dời vách ngăn',
      file: { fileId: 'fB', url: '/api/v1/files/fB', fileName: 'KT-101_B.pdf', size: 4 },
    });
    post.flush(drawing(['A', 'B']));
    await settle();
    http.expectOne('/api/v1/files/fB').flush(bytes(2));

    await expect(adding).resolves.toBe(true);
    expect(store.revision()?.revision).toBe('B');
    expect(notification.success).toHaveBeenCalledWith('Đã phát hành phiên bản B.');
  });
});
