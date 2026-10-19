import { getResponse } from 'msw';
import { LoginResponse } from '../../shared/models/auth.model';
import { db } from '../db';
import { handlers } from '../handlers';
import { mockSettings } from '../utils/http.utils';

/** Chỉ dùng trong unit test: gọi thẳng MSW handler, không cần service worker. */
export const DEMO_EMAILS = {
  admin: 'admin@cpm.vn',
  pm: 'pm@cpm.vn',
  engineer: 'kysu@cpm.vn',
  client: 'chudautu@cpm.vn',
} as const;

export type DemoRole = keyof typeof DEMO_EMAILS;

/** Tắt độ trễ/lỗi ngẫu nhiên và nạp lại seed. */
export function resetMockBackend(): void {
  mockSettings.minDelayMs = 0;
  mockSettings.maxDelayMs = 0;
  mockSettings.randomErrors = false;
  db.reset();
}

export async function callApi(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  const request = new Request(`${location.origin}/api/v1${path}`, {
    ...rest,
    headers: {
      // FormData tự đặt multipart boundary, chỉ gắn JSON khi body là chuỗi.
      ...(typeof rest.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  const response = await getResponse(handlers, request);
  if (!response) {
    throw new Error(`Không có handler cho ${init.method ?? 'GET'} ${path}`);
  }
  return response;
}

export async function tokenFor(role: DemoRole): Promise<string> {
  const response = await callApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: DEMO_EMAILS[role], password: 'Demo@123' }),
  });
  return ((await response.json()) as LoginResponse).accessToken;
}

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
