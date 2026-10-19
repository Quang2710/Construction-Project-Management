import { DEMO_ACCOUNTS } from '../../core/config/demo-accounts';
import { LoginResponse } from '../../shared/models/auth.model';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

describe('Fake BE: auth & phân quyền', () => {
  beforeAll(() => resetMockBackend());

  it('cả 4 tài khoản demo đều đăng nhập được và không lộ mật khẩu', async () => {
    for (const account of DEMO_ACCOUNTS) {
      const response = await callApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, password: account.password }),
      });
      expect(response.status).toBe(200);
      const body = await json<LoginResponse & { user: Record<string, unknown> }>(response);
      expect(body.user['role']).toBe(account.role);
      expect(body.user['password']).toBeUndefined();
    }
  });

  it('sai mật khẩu trả 401 với code INVALID_CREDENTIALS', async () => {
    const response = await callApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@cpm.vn', password: 'sai' }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('/auth/me: thiếu token trả 401, có token trả đúng user', async () => {
    expect((await callApi('/auth/me')).status).toBe(401);

    const response = await callApi('/auth/me', { token: await tokenFor('engineer') });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ email: 'kysu@cpm.vn', role: 'SITE_ENGINEER' });
  });

  it('/users: CLIENT bị 403, ADMIN nhận danh sách phân trang', async () => {
    const forbidden = await callApi('/users', { token: await tokenFor('client') });
    expect(forbidden.status).toBe(403);

    const ok = await callApi('/users?page=1&pageSize=5', { token: await tokenFor('admin') });
    expect(ok.status).toBe(200);
    const body = await json<{ data: unknown[]; total: number }>(ok);
    expect(body.data).toHaveLength(5);
    expect(body.total).toBeGreaterThan(20);
  });
});
