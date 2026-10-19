import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Project } from '../../projects/models/project.model';
import { SiteDiary } from '../models/site-diary.model';
import { DiaryCalendarStore } from './diary-calendar.store';

const PROJECT = {
  id: 'prj-1',
  code: 'HN-01',
  name: 'Dự án 1',
  status: 'IN_PROGRESS',
  startDate: '2026-01-01',
  endDate: '2027-12-31',
} as Project;

function diary(date: string): SiteDiary {
  return {
    id: `dry-${date}`,
    projectId: PROJECT.id,
    project: { id: PROJECT.id, code: PROJECT.code, name: PROJECT.name, lat: 21, lng: 105 },
    date,
    status: 'APPROVED',
  } as SiteDiary;
}

function page<T>(data: T[]) {
  return { data, total: data.length, page: 1, pageSize: 500 };
}

describe('DiaryCalendarStore', () => {
  let store: InstanceType<typeof DiaryCalendarStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DiaryCalendarStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DiaryCalendarStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne((req) => req.url === '/api/v1/projects').flush(page([PROJECT]));
    http.expectOne((req) => req.url === '/api/v1/site-diaries').flush(page([]));
  });

  afterEach(() => http.verify());

  it('gọi API theo khoảng ngày của lưới tháng và bộ lọc', () => {
    store.setMonth('2026-09');
    store.setProject(PROJECT.id);
    store.setStatus('SUBMITTED');
    TestBed.tick();
    const request = http.expectOne((req) => req.url === '/api/v1/site-diaries');
    expect(request.request.params.get('from')).toBe('2026-08-31');
    expect(request.request.params.get('to')).toBe('2026-10-04');
    expect(request.request.params.get('projectId')).toBe(PROJECT.id);
    expect(request.request.params.get('status')).toBe('SUBMITTED');
    request.flush(page([]));
  });

  it('đánh dấu ngày làm việc đã qua chưa có nhật ký (bỏ qua Chủ nhật)', () => {
    store.setMonth('2026-09');
    store.setProject(PROJECT.id);
    TestBed.tick();
    http.expectOne((req) => req.url === '/api/v1/site-diaries').flush(page([diary('2026-09-01')]));

    const days = new Map(store.weeks().flat().map((day) => [day.date, day]));
    expect(days.get('2026-09-01')?.diaries).toHaveLength(1);
    expect(days.get('2026-09-01')?.missing).toBe(false);
    expect(days.get('2026-09-02')?.missing).toBe(true);
    expect(days.get('2026-09-06')?.missing).toBe(false); // Chủ nhật

    store.selectDate('2026-09-01');
    expect(store.selectedDiaries().map((item) => item.id)).toEqual(['dry-2026-09-01']);
  });

  it('không cảnh báo thiếu khi xem tất cả dự án', () => {
    store.setMonth('2026-09');
    TestBed.tick();
    http.expectOne((req) => req.url === '/api/v1/site-diaries').flush(page([]));
    expect(store.weeks().flat().some((day) => day.missing)).toBe(false);
  });
});
