import { http, HttpResponse } from 'msw';
import { LoginRequest, LoginResponse } from '../../shared/models/auth.model';
import { db } from '../db';
import { authenticate, createFakeJwt, TOKEN_TTL_SECONDS, toPublicUser } from '../utils/auth.utils';
import { apiUrl, errorResponse, readJsonBody, simulateNetwork } from '../utils/http.utils';

function isLoginRequest(value: unknown): value is LoginRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return typeof body['email'] === 'string' && typeof body['password'] === 'string';
}

export const authHandlers = [
  http.post(apiUrl('/auth/login'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }

    const body = await readJsonBody(request);
    if (!isLoginRequest(body) || !body.email.trim() || !body.password) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Vui lòng nhập email và mật khẩu.');
    }

    const email = body.email.trim().toLowerCase();
    const user = db.users.findOne((item) => item.email.toLowerCase() === email);
    if (!user || user.password !== body.password) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
    }
    if (!user.active) {
      return errorResponse(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.');
    }

    const response: LoginResponse = {
      accessToken: createFakeJwt(user),
      expiresIn: TOKEN_TTL_SECONDS,
      user: toPublicUser(user),
    };
    return HttpResponse.json(response);
  }),

  http.get(apiUrl('/auth/me'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    return auth.ok ? HttpResponse.json(toPublicUser(auth.user)) : auth.response;
  }),

  http.post(apiUrl('/auth/logout'), async () => {
    await simulateNetwork();
    return new HttpResponse(null, { status: 204 });
  }),
];
