import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore, TOKEN_STORAGE_KEY } from '../../core/auth/auth.store';
import { User } from '../models/user.model';
import { HasRoleDirective } from './has-role.directive';

@Component({
  imports: [HasRoleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span *hasRole="['ADMIN']" class="admin-only">admin</span>
    <span *hasRole="['ADMIN', 'CLIENT']" class="admin-or-client">shared</span>
  `,
})
class HostComponent {}

describe('HasRoleDirective', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('ẩn toàn bộ khi chưa đăng nhập', async () => {
    const el = await render();
    expect(el.querySelector('.admin-only')).toBeNull();
    expect(el.querySelector('.admin-or-client')).toBeNull();
  });

  it('chỉ hiện phần tử khớp role của user', async () => {
    const user: User = {
      id: 'usr-client',
      email: 'chudautu@cpm.vn',
      fullName: 'Phạm Minh Dũng',
      role: 'CLIENT',
      jobTitle: 'Đại diện chủ đầu tư',
      phone: '0934 567 890',
      active: true,
      createdAt: '2024-01-15T08:00:00.000Z',
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token');
    const pending = TestBed.inject(AuthStore).restoreSession();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/me').flush(user);
    await pending;

    const el = await render();
    expect(el.querySelector('.admin-only')).toBeNull();
    expect(el.querySelector('.admin-or-client')).not.toBeNull();
  });
});
