import { HttpResponse } from 'msw';
import { ApiError } from '../../shared/models/api.model';
import { isUserRole, User, UserRole } from '../../shared/models/user.model';
import { db } from '../db';
import { UserRecord } from '../models/mock-records';
import { errorResponse } from './http.utils';

export const TOKEN_TTL_SECONDS = 8 * 60 * 60;

interface FakeJwtPayload {
  readonly sub: string;
  readonly role: UserRole;
  readonly iat: number;
  readonly exp: number;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
}

function isFakeJwtPayload(value: unknown): value is FakeJwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload['sub'] === 'string' &&
    isUserRole(payload['role']) &&
    typeof payload['iat'] === 'number' &&
    typeof payload['exp'] === 'number'
  );
}

/** JWT giả: header.payload.signature, chữ ký không có giá trị bảo mật. */
export function createFakeJwt(user: User): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: FakeJwtPayload = { sub: user.id, role: user.role, iat: now, exp: now + TOKEN_TTL_SECONDS };
  return [
    base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64UrlEncode(JSON.stringify(payload)),
    base64UrlEncode('cpm-fake-signature'),
  ].join('.');
}

function decodeFakeJwt(token: string): FakeJwtPayload | null {
  const [, payloadPart] = token.split('.');
  if (!payloadPart) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(base64UrlDecode(payloadPart));
    return isFakeJwtPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function toPublicUser(record: UserRecord): User {
  const { password: _password, ...user } = record;
  return user;
}

export type AuthResult =
  | { readonly ok: true; readonly user: UserRecord }
  | { readonly ok: false; readonly response: HttpResponse<ApiError> };

/**
 * Xác thực Bearer token và (tuỳ chọn) kiểm tra role.
 * Trả về 401 khi thiếu/sai/hết hạn token, 403 khi role không được phép.
 */
export function authenticate(request: Request, allowedRoles?: readonly UserRole[]): AuthResult {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? decodeFakeJwt(token) : null;

  if (!payload) {
    return { ok: false, response: errorResponse(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập hoặc token không hợp lệ.') };
  }
  if (payload.exp * 1000 < Date.now()) {
    return { ok: false, response: errorResponse(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn.') };
  }

  const user = db.users.findById(payload.sub);
  if (!user || !user.active) {
    return { ok: false, response: errorResponse(401, 'UNAUTHORIZED', 'Tài khoản không tồn tại hoặc đã bị khoá.') };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { ok: false, response: errorResponse(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.') };
  }
  return { ok: true, user };
}
