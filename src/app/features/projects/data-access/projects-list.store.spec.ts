import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProjectsListStore } from './projects-list.store';

describe('ProjectsListStore', () => {
  let store: InstanceType<typeof ProjectsListStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectsListStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ProjectsListStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  function respond(total = 0): void {
    http.expectOne((req) => req.url === '/api/v1/projects').flush({ data: [], total, page: 1, pageSize: 10 });
  }

  it('tải trang đầu với sắp xếp mặc định theo mã', () => {
    const request = http.expectOne((req) => req.url === '/api/v1/projects');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('sort')).toBe('code');
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ data: [], total: 0, page: 1, pageSize: 10 });
    expect(store.isEmpty()).toBe(true);
  });

  it('đổi bộ lọc trạng thái thì về trang 1 và gọi lại API', () => {
    respond(30);
    store.setPage(3, 10);
    TestBed.tick();
    respond(30);

    store.setStatus('IN_PROGRESS');
    TestBed.tick();
    const request = http.expectOne((req) => req.url === '/api/v1/projects');
    expect(request.request.params.get('status')).toBe('IN_PROGRESS');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ data: [], total: 0, page: 1, pageSize: 10 });
  });

  it('sắp xếp giảm dần dùng tiền tố "-"', () => {
    respond();
    store.setSort('budget', 'desc');
    TestBed.tick();
    const request = http.expectOne((req) => req.url === '/api/v1/projects');
    expect(request.request.params.get('sort')).toBe('-budget');
    request.flush({ data: [], total: 0, page: 1, pageSize: 10 });
  });

  it('lỗi API hiển thị error state, reload gọi lại', () => {
    http
      .expectOne((req) => req.url === '/api/v1/projects')
      .flush({ code: 'INTERNAL_ERROR', message: 'Máy chủ lỗi' }, { status: 500, statusText: 'Error' });
    expect(store.error()).toBe('Máy chủ lỗi');

    store.reload();
    TestBed.tick();
    respond(0);
    expect(store.error()).toBeNull();
  });
});
