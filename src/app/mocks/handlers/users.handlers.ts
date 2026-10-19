import { http, HttpResponse } from 'msw';
import { User } from '../../shared/models/user.model';
import { db } from '../db';
import { authenticate, toPublicUser } from '../utils/auth.utils';
import { apiUrl, errorResponse, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';

const SEARCH_FIELDS: readonly (keyof User & string)[] = ['fullName', 'email', 'jobTitle', 'phone'];

export const usersHandlers = [
  http.get(apiUrl('/users'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, ['ADMIN', 'PROJECT_MANAGER']);
    if (!auth.ok) {
      return auth.response;
    }
    const users = db.users.all().map(toPublicUser);
    return HttpResponse.json(applyListQuery(users, parseListQuery(new URL(request.url)), SEARCH_FIELDS));
  }),

  http.get(apiUrl('/users/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request, ['ADMIN', 'PROJECT_MANAGER']);
    if (!auth.ok) {
      return auth.response;
    }
    const user = db.users.findById(String(params['id']));
    return user ? HttpResponse.json(toPublicUser(user)) : errorResponse(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
  }),
];
