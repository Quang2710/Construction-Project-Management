import { AppNotification, NotificationPage, RealtimeMessage } from '../../shared/models/notification.model';
import { todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { nextActivity } from '../realtime/activity-simulator';
import { notificationHub } from '../realtime/notification-hub';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

/** Giả một kết nối WebSocket: ghi lại các thông điệp server đẩy xuống. */
function listen(userId: string): { messages: RealtimeMessage[]; close: () => void } {
  const messages: RealtimeMessage[] = [];
  const close = notificationHub.connect(userId, (message) => messages.push(message));
  return { messages, close };
}

const pushed = (messages: readonly RealtimeMessage[]): AppNotification[] =>
  messages.flatMap((message) => (message.type === 'notification' ? [message.data] : []));

describe('Fake BE: thông báo real-time', () => {
  beforeEach(() => {
    resetMockBackend();
    notificationHub.reset();
  });

  it('kết nối nhận ngay số chưa đọc; danh sách chỉ của chính mình', async () => {
    const pm = listen('usr-pm');
    expect(pm.messages[0]).toEqual({ type: 'unread-count', data: db.notifications.filter((n) => n.userId === 'usr-pm' && !n.readAt).length });

    const page = await json<NotificationPage>(await callApi('/notifications?pageSize=50', { token: await tokenFor('pm') }));
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.unreadCount).toBe(page.data.filter((item) => !item.read).length);
    expect(page.data.map((item) => item.id).every((id) => db.notifications.findById(id)?.userId === 'usr-pm')).toBe(true);
  });

  it('kỹ sư gửi nhật ký → PM nhận thông báo ngay; người thao tác không tự nhận', async () => {
    const pm = listen('usr-pm');
    const engineer = listen('usr-engineer');
    const token = await tokenFor('engineer');
    const created = await json<{ id: string }>(
      await callApi('/site-diaries', {
        method: 'POST',
        token,
        body: JSON.stringify({
          projectId: 'prj-gthm',
          date: '2020-01-01',
          weather: { morning: 'SUNNY', afternoon: 'CLOUDY', minTemp: null, maxTemp: null },
          labor: [],
          equipment: [],
          workItems: [],
          incidents: [],
          notes: '',
          photos: [],
        }),
      }),
    );
    await callApi(`/site-diaries/${created.id}/submit`, { method: 'POST', token });

    const received = pushed(pm.messages);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'DIARY', link: `/site-diaries/${created.id}`, read: false, projectCode: expect.any(String) });
    expect(pushed(engineer.messages)).toHaveLength(0);
  });

  it('luồng nghiệm thu: gửi duyệt báo PM, duyệt cấp 1 báo QA/QC, nghiệm thu xong báo người lập', async () => {
    const engineerToken = await tokenFor('engineer');
    const pm = listen('usr-pm');
    const admin = listen('usr-admin');
    const engineer = listen('usr-engineer');
    const wbs = db.wbs.filter((node) => node.projectId === 'prj-gthm');
    const leaf = wbs.find((node) => !wbs.some((child) => child.parentId === node.id));
    const created = await json<{ id: string; title: string; location: string; inspectionDate: string; items: { id: string }[] }>(
      await callApi('/inspections', {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({ projectId: 'prj-gthm', wbsId: leaf?.id, templateId: 'tpl-concrete', title: 'NT bê tông', location: '', inspectionDate: todayIso() }),
      }),
    );
    await callApi(`/inspections/${created.id}`, {
      method: 'PUT',
      token: engineerToken,
      body: JSON.stringify({ ...created, items: created.items.map((item) => ({ ...item, result: 'PASS' })) }),
    });
    await callApi(`/inspections/${created.id}/submit`, { method: 'POST', token: engineerToken });
    expect(pushed(pm.messages).map((item) => item.title)).toEqual([expect.stringContaining('chờ duyệt cấp 1')]);

    await callApi(`/inspections/${created.id}/approve`, { method: 'POST', token: await tokenFor('pm'), body: '{}' });
    expect(pushed(admin.messages).map((item) => item.title)).toEqual([expect.stringContaining('chờ duyệt cấp 2')]);

    await callApi(`/inspections/${created.id}/approve`, { method: 'POST', token: await tokenFor('admin'), body: '{}' });
    expect(pushed(engineer.messages).map((item) => item.title)).toEqual([expect.stringContaining('đã nghiệm thu')]);
  });

  it('đánh dấu đã đọc từng cái / tất cả, đồng bộ số chưa đọc tới mọi tab', async () => {
    const token = await tokenFor('pm');
    const tabA = listen('usr-pm');
    const tabB = listen('usr-pm');
    const [first] = notificationHub.notify(['usr-pm'], { type: 'SYSTEM', title: 'A', message: '', link: null });
    notificationHub.notify(['usr-pm'], { type: 'SYSTEM', title: 'B', message: '', link: null });
    expect(pushed(tabB.messages)).toHaveLength(2);

    const read = await json<AppNotification>(await callApi(`/notifications/${first.id}`, { method: 'PATCH', token, body: JSON.stringify({ read: true }) }));
    expect(read.read).toBe(true);
    const before = await json<NotificationPage>(await callApi('/notifications?unreadOnly=true', { token }));
    expect(before.data.some((item) => item.id === first.id)).toBe(false);

    expect((await callApi('/notifications/read-all', { method: 'POST', token })).status).toBe(204);
    expect(tabA.messages.at(-1)).toEqual({ type: 'unread-count', data: 0 });
    expect(tabB.messages.at(-1)).toEqual({ type: 'unread-count', data: 0 });

    const other = await callApi(`/notifications/${first.id}`, { method: 'PATCH', token: await tokenFor('engineer'), body: JSON.stringify({ read: true }) });
    expect(other.status).toBe(404);
  });

  it('ngắt kết nối thì không còn nhận; giả lập hoạt động sinh sự kiện từ dữ liệu thật', () => {
    const pm = listen('usr-pm');
    pm.close();
    notificationHub.notify(['usr-pm'], { type: 'SYSTEM', title: 'X', message: '', link: null });
    expect(pushed(pm.messages)).toHaveLength(0);
    expect(notificationHub.connectedUserIds()).not.toContain('usr-pm');

    const activity = nextActivity('usr-pm');
    expect(activity).not.toBeNull();
    expect(['SCHEDULE', 'MATERIAL', 'WEATHER']).toContain(activity?.type);
    expect(nextActivity('khong-ton-tai')).toBeNull();
  });
});
