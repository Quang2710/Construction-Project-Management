import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoginResponse } from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';
import { AuthStore, TOKEN_STORAGE_KEY } from './auth.store';

const USER: User = {
  id: 'usr-pm',
  email: 'pm@cpm.vn',
  fullName: 'Trần Thị Bình',
  role: 'PROJECT_MANAGER',
  jobTitle: 'Giám đốc dự án',
  phone: '0912 345 678',
  active: true,
  createdAt: '2024-01-15T08:00:00.000Z',
};

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('đăng nhập thành công: lưu token, user và role', async () => {
    const pending = store.login({ email: USER.email, password: 'Demo@123' });
    const response: LoginResponse = { accessToken: 'token-123', expiresIn: 3600, user: USER };
    http.expectOne('/api/v1/auth/login').flush(response);

    await expect(pending).resolves.toBe(true);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBe('PROJECT_MANAGER');
    expect(store.roleLabel()).toBe('Quản lý dự án');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-123');
  });

  it('đăng nhập sai: hiển thị thông báo lỗi từ API', async () => {
    const pending = store.login({ email: USER.email, password: 'sai-mat-khau' });
    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expect(pending).resolves.toBe(false);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.error()).toBe('Email hoặc mật khẩu không đúng.');
  });

  it('restoreSession: không có token thì chuyển sang unauthenticated, không gọi API', async () => {
    await store.restoreSession();
    expect(store.status()).toBe('unauthenticated');
  });

  it('restoreSession: token hết hạn thì xoá phiên', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired');
    const pending = store.restoreSession();
    http.expectOne('/api/v1/auth/me').flush(
      { code: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await pending;

    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('hasAnyRole kiểm tra theo role hiện tại', async () => {
    expect(store.hasAnyRole(['PROJECT_MANAGER'])).toBe(false);

    localStorage.setItem(TOKEN_STORAGE_KEY, 'valid');
    const pending = store.restoreSession();
    http.expectOne('/api/v1/auth/me').flush(USER);
    await pending;

    expect(store.hasAnyRole(['ADMIN', 'PROJECT_MANAGER'])).toBe(true);
    expect(store.hasAnyRole(['ADMIN'])).toBe(false);
  });

  it('logout: xoá phiên kể cả khi API lỗi', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'valid');
    const restoring = store.restoreSession();
    http.expectOne('/api/v1/auth/me').flush(USER);
    await restoring;

    const pending = store.logout();
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });
    await pending;

    expect(store.user()).toBeNull();
    expect(store.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
