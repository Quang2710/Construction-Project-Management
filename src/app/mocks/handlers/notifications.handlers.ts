import { http, HttpResponse, ws } from 'msw';
import { environment } from '../../../environments/environment';
import { NotificationPage } from '../../shared/models/notification.model';
import { db } from '../db';
import { startActivitySimulation } from '../realtime/activity-simulator';
import { notificationHub, toNotificationDto, unreadCount } from '../realtime/notification-hub';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, mockSettings, readJsonBody, simulateNetwork } from '../utils/http.utils';
import { applyListQuery, parseListQuery } from '../utils/list-query';
import { isRecord } from '../utils/validation';

export const notificationsHandlers = [
  http.get(apiUrl('/notifications'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    url.searchParams.delete('unreadOnly');
    const query = parseListQuery(url, { maxPageSize: 100 });
    const items = db.notifications
      .filter((item) => item.userId === auth.user.id && (!unreadOnly || item.readAt === null))
      .map(toNotificationDto);
    const page = applyListQuery(items, { ...query, sort: query.sort ?? { field: 'createdAt', direction: 'desc' } }, ['title', 'message']);
    const body: NotificationPage = { ...page, unreadCount: unreadCount(auth.user.id) };
    return HttpResponse.json(body);
  }),

  http.patch(apiUrl('/notifications/:id'), async ({ request, params }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const record = db.notifications.findById(String(params['id']));
    if (!record || record.userId !== auth.user.id) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
    }
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body['read'] !== 'boolean') {
      return errorResponse(422, 'VALIDATION_ERROR', 'Trường "read" phải là true/false.');
    }
    const updated = db.notifications.update(record.id, { readAt: body['read'] ? (record.readAt ?? new Date().toISOString()) : null });
    notificationHub.syncUnread(auth.user.id);
    return HttpResponse.json(toNotificationDto(updated ?? record));
  }),

  http.post(apiUrl('/notifications/read-all'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    const now = new Date().toISOString();
    for (const record of db.notifications.filter((item) => item.userId === auth.user.id && item.readAt === null)) {
      db.notifications.update(record.id, { readAt: now });
    }
    notificationHub.syncUnread(auth.user.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

const realtime = ws.link(new RegExp(`${environment.realtimePath.replace(/\//g, '\\/')}(\\?.*)?$`));

/**
 * WebSocket giả lập (MSW chặn `new WebSocket(...)` ngay trong trang).
 * Trình duyệt không gửi header Authorization cho WebSocket nên token đi qua query `?token=`.
 * Tách khỏi `handlers` vì chỉ worker trình duyệt dùng được; unit test gọi notificationHub trực tiếp.
 */
export const realtimeHandlers = [
  realtime.addEventListener('connection', ({ client }) => {
    const token = client.url.searchParams.get('token') ?? '';
    const auth = authenticate(new Request(client.url.href.replace(/^ws/, 'http'), { headers: { Authorization: `Bearer ${token}` } }));
    if (!auth.ok) {
      // 4401: mã đóng tuỳ chỉnh = token không hợp lệ, client không tự kết nối lại.
      client.close(4401, 'Unauthorized');
      return;
    }
    const disconnect = notificationHub.connect(auth.user.id, (message) => client.send(JSON.stringify(message)));
    client.addEventListener('close', disconnect);
    startActivitySimulation(mockSettings.simulatedNotificationMs);
  }),
];
