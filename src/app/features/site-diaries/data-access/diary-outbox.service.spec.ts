import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OutboxContext, OutboxService } from '../../../core/offline/outbox.service';
import { ImageCompressor } from '../../../shared/data-access/image-compressor.service';
import { DiaryOutboxPayload, DiaryOutboxService } from './diary-outbox.service';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function payload(overrides: Partial<DiaryOutboxPayload> = {}): DiaryOutboxPayload {
  return {
    diaryId: null,
    projectId: 'prj-1',
    projectCode: 'P1',
    date: '2026-10-26',
    content: {
      weather: { morning: 'SUNNY', afternoon: 'SUNNY', minTemp: null, maxTemp: null },
      labor: [],
      equipment: [],
      workItems: [],
      incidents: [],
      notes: 'Đổ bê tông sàn tầng 5',
      photos: [],
    },
    pendingPhotos: [{ blob: new Blob(['x'], { type: 'image/jpeg' }), fileName: 'IMG_1.heic', caption: 'Sàn', takenAt: '2026-10-26T08:00:00Z', location: null }],
    submit: true,
    ...overrides,
  };
}

describe('DiaryOutboxService.process', () => {
  let service: DiaryOutboxService;
  let http: HttpTestingController;
  const progress: DiaryOutboxPayload[] = [];
  const context: OutboxContext<DiaryOutboxPayload> = {
    saveProgress: async (value) => void progress.push(value),
  };

  beforeEach(() => {
    progress.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OutboxService, useValue: { entries: () => [] } },
        { provide: ImageCompressor, useValue: { compress: async (blob: Blob) => blob } },
      ],
    });
    service = TestBed.inject(DiaryOutboxService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('tải ảnh chụp offline → tạo nhật ký → gửi duyệt, lưu tiến độ từng bước', async () => {
    const pending = service.process(payload(), context);
    await settle();
    const upload = http.expectOne('/api/v1/uploads');
    expect((upload.request.body as FormData).get('file')).toBeInstanceOf(Blob);
    upload.flush({ id: 'f1', url: '/api/v1/files/f1', fileName: 'IMG_1.jpg', mimeType: 'image/jpeg', size: 1 });
    await settle();

    const create = http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/site-diaries');
    expect(create.request.body.photos).toEqual([expect.objectContaining({ id: 'f1', caption: 'Sàn' })]);
    create.flush({ id: 'dry-1' });
    await settle();
    http.expectOne('/api/v1/site-diaries/dry-1/submit').flush({ id: 'dry-1' });

    await expect(pending).resolves.toMatchObject({ kind: 'done', link: '/site-diaries/dry-1' });
    expect(progress.map((item) => [item.pendingPhotos.length, item.diaryId])).toEqual([
      [0, null],
      [0, 'dry-1'],
    ]);
  });

  it('mất mạng khi gửi duyệt: báo offline, lần sau chỉ gửi duyệt (không tạo trùng)', async () => {
    const first = service.process(payload({ pendingPhotos: [] }), context);
    http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/site-diaries').flush({ id: 'dry-2' });
    await settle();
    http.expectOne('/api/v1/site-diaries/dry-2/submit').flush(null, { status: 0, statusText: 'Unknown Error' });
    await expect(first).resolves.toEqual({ kind: 'offline' });

    const resumed = progress.at(-1);
    expect(resumed?.diaryId).toBe('dry-2');
    const second = service.process(resumed ?? payload(), context);
    http.expectOne((req) => req.method === 'PUT' && req.url === '/api/v1/site-diaries/dry-2').flush({ id: 'dry-2' });
    await settle();
    http.expectOne('/api/v1/site-diaries/dry-2/submit').flush({ id: 'dry-2' });
    await expect(second).resolves.toMatchObject({ kind: 'done' });
  });

  it('server từ chối (trùng ngày) → failed với thông báo tiếng Việt của BE', async () => {
    const pending = service.process(payload({ pendingPhotos: [], submit: false }), context);
    http
      .expectOne((req) => req.method === 'POST')
      .flush({ code: 'DIARY_EXISTS', message: 'Dự án đã có nhật ký cho ngày này.' }, { status: 409, statusText: 'Conflict' });
    await expect(pending).resolves.toEqual({ kind: 'failed', message: 'Dự án đã có nhật ký cho ngày này.' });
  });
});
