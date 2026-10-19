import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { User, UserRole } from '../../shared/models/user.model';
import { authGuard, guestGuard } from './auth.guard';
import { AuthStore, TOKEN_STORAGE_KEY } from './auth.store';
import { roleGuard } from './role.guard';

function routeWithRoles(roles?: readonly UserRole[]): ActivatedRouteSnapshot {
  return { data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot;
}

const STATE = { url: '/budget' } as RouterStateSnapshot;

async function signInAs(role: UserRole): Promise<void> {
  const user: User = {
    id: 'usr-test',
    email: 'test@cpm.vn',
    fullName: 'Người Kiểm Thử',
    role,
    jobTitle: 'Kiểm thử',
    phone: '0900 000 000',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, 'token');
  const pending = TestBed.inject(AuthStore).restoreSession();
  TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/me').flush(user);
  await pending;
}

function run<T>(fn: () => T): T {
  return TestBed.runInInjectionContext(fn);
}

describe('Guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('authGuard: chưa đăng nhập thì chuyển về /login kèm returnUrl', () => {
    const result = run(() => authGuard(routeWithRoles(), STATE));
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fbudget');
  });

  it('authGuard: đã đăng nhập thì cho qua', async () => {
    await signInAs('CLIENT');
    expect(run(() => authGuard(routeWithRoles(), STATE))).toBe(true);
  });

  it('guestGuard: đã đăng nhập thì không vào lại trang login', async () => {
    await signInAs('ADMIN');
    expect(run(() => guestGuard(routeWithRoles(), STATE))).toBeInstanceOf(UrlTree);
  });

  it('roleGuard: route không khai báo roles thì mọi role đều vào được', async () => {
    await signInAs('CLIENT');
    expect(run(() => roleGuard(routeWithRoles(), STATE))).toBe(true);
  });

  it('roleGuard: role được phép thì cho qua', async () => {
    await signInAs('PROJECT_MANAGER');
    expect(run(() => roleGuard(routeWithRoles(['ADMIN', 'PROJECT_MANAGER']), STATE))).toBe(true);
  });

  it('roleGuard: vượt quyền thì chuyển tới /forbidden', async () => {
    await signInAs('SITE_ENGINEER');
    const result = run(() => roleGuard(routeWithRoles(['ADMIN']), STATE));
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });
});
