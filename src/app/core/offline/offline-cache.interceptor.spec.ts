import { HttpClient, HttpErrorResponse, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { NetworkStatusService } from './network-status.service';
import { OFFLINE_CACHE_HEADER, offlineCacheInterceptor } from './offline-cache.interceptor';
import { OfflineCacheService, tokenSubject } from './offline-cache.service';

/** JWT giả với payload { sub }. */
function jwt(sub: string): string {
  return `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const offlineError = { status: 0, statusText: 'Unknown Error' };

describe('offlineCacheInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let network: NetworkStatusService;

  function get(url: string, user = 'u1') {
    return firstValueFrom(http.get<unknown>(url, { headers: { Authorization: `Bearer ${jwt(user)}` }, observe: 'response' }));
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([offlineCacheInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    network = TestBed.inject(NetworkStatusService);
    await TestBed.inject(OfflineCacheService).clear();
  });

  afterEach(() => backend.verify());

  it('đọc sub từ JWT; token hỏng → null', () => {
    expect(tokenSubject(jwt('usr-pm'))).toBe('usr-pm');
    expect(tokenSubject('khong-phai-jwt')).toBeNull();
  });

  it('có mạng: trả dữ liệu mới và lưu lại; mất mạng: trả bản đã lưu kèm header + báo đang xem cache', async () => {
    const online = get('/api/v1/projects?page=1');
    backend.expectOne('/api/v1/projects?page=1').flush({ data: [1, 2] });
    expect((await online).body).toEqual({ data: [1, 2] });
    await settle();

    const offline = get('/api/v1/projects?page=1');
    backend.expectOne('/api/v1/projects?page=1').flush(null, offlineError);
    const response = await offline;
    expect(response).toBeInstanceOf(HttpResponse);
    expect(response.body).toEqual({ data: [1, 2] });
    expect(response.headers.get(OFFLINE_CACHE_HEADER)).toBeTruthy();
    expect(network.cachedDataAt()).not.toBeNull();
  });

  it('cache tách theo người dùng và theo query; chưa có cache thì vẫn báo lỗi mất mạng', async () => {
    const first = get('/api/v1/tasks?projectId=a', 'u1');
    backend.expectOne('/api/v1/tasks?projectId=a').flush({ data: ['u1'] });
    await first;
    await settle();

    const otherUser = get('/api/v1/tasks?projectId=a', 'u2');
    backend.expectOne('/api/v1/tasks?projectId=a').flush(null, offlineError);
    await expect(otherUser).rejects.toBeInstanceOf(HttpErrorResponse);

    const otherQuery = get('/api/v1/tasks?projectId=b', 'u1');
    backend.expectOne('/api/v1/tasks?projectId=b').flush(null, offlineError);
    await expect(otherQuery).rejects.toMatchObject({ status: 0 });
  });

  it('không cache: lỗi HTTP thật (404), request ghi, file nhị phân, request chưa đăng nhập', async () => {
    const cached = get('/api/v1/projects/p1');
    backend.expectOne('/api/v1/projects/p1').flush({ id: 'p1' });
    await cached;
    await settle();
    const notFound = get('/api/v1/projects/p1');
    backend.expectOne('/api/v1/projects/p1').flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await expect(notFound).rejects.toMatchObject({ status: 404 });

    const post = firstValueFrom(http.post('/api/v1/projects', {}, { headers: { Authorization: `Bearer ${jwt('u1')}` } }));
    backend.expectOne('/api/v1/projects').flush(null, offlineError);
    await expect(post).rejects.toMatchObject({ status: 0 });

    const anonymous = firstValueFrom(http.get('/api/v1/projects/p1'));
    backend.expectOne('/api/v1/projects/p1').flush(null, offlineError);
    await expect(anonymous).rejects.toMatchObject({ status: 0 });
  });
});
