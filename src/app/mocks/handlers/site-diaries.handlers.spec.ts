import { DiaryCreateRequest, SiteDiary } from '../../features/site-diaries/models/site-diary.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { UploadedFile } from '../../shared/models/upload.model';
import { todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

/** Một ngày đã qua chưa có nhật ký của dự án (để test tạo mới). */
function freeDate(projectId: string): string {
  const taken = new Set(db.siteDiaries.filter((diary) => diary.projectId === projectId).map((diary) => diary.date));
  for (let offset = 40; offset < 400; offset++) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!taken.has(iso)) {
      return iso;
    }
  }
  throw new Error('Không tìm được ngày trống');
}

/**
 * Body multipart/form-data dựng tay (jsdom thay FormData toàn cục bằng bản không tương thích
 * với Request của Node, nên không dùng FormData trong test).
 */
function multipart(fileName: string, type: string, bytes: Uint8Array): { body: ArrayBuffer; headers: Record<string, string> } {
  const boundary = '----cpm-test-boundary';
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body: body.buffer, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

function newDiary(projectId: string, date: string): DiaryCreateRequest {
  return {
    projectId,
    date,
    weather: { morning: 'SUNNY', afternoon: 'LIGHT_RAIN', minTemp: 24, maxTemp: 31 },
    labor: [{ crew: 'Tổ cốt thép', headcount: 12 }],
    equipment: [{ name: 'Cần trục tháp', quantity: 1, hours: 8 }],
    workItems: [{ description: 'Lắp dựng cốt thép sàn tầng 5', unit: 'tấn', quantity: 6.5 }],
    incidents: [],
    notes: 'Thi công bình thường.',
    photos: [],
  };
}

describe('Fake BE: /site-diaries', () => {
  beforeEach(() => resetMockBackend());

  it('seed có nhật ký 30 ngày cho các dự án đang thi công, đủ các trạng thái', async () => {
    const body = await json<PaginatedResponse<SiteDiary>>(
      await callApi('/site-diaries?pageSize=500', { token: await tokenFor('admin') }),
    );
    expect(body.total).toBeGreaterThan(100);
    const statuses = new Set(body.data.map((diary) => diary.status));
    expect([...statuses].sort()).toEqual(['APPROVED', 'DRAFT', 'REJECTED', 'SUBMITTED']);
    expect(body.data.every((diary) => diary.totalWorkers === diary.labor.reduce((sum, item) => sum + item.headcount, 0))).toBe(true);
    // Mặc định sắp ngày mới nhất trước.
    expect(body.data[0].date >= body.data[body.data.length - 1].date).toBe(true);
  });

  it('lọc theo dự án, trạng thái và khoảng ngày', async () => {
    const token = await tokenFor('pm');
    const today = todayIso();
    const body = await json<PaginatedResponse<SiteDiary>>(
      await callApi(`/site-diaries?projectId=prj-gthm&status=APPROVED&from=2000-01-01&to=${today}&pageSize=500`, { token }),
    );
    expect(body.total).toBeGreaterThan(0);
    expect(body.data.every((diary) => diary.projectId === 'prj-gthm' && diary.status === 'APPROVED')).toBe(true);
  });

  it('CLIENT chỉ thấy nhật ký đã duyệt; kỹ sư chỉ thấy dự án được gán', async () => {
    const client = await json<PaginatedResponse<SiteDiary>>(
      await callApi('/site-diaries?pageSize=500', { token: await tokenFor('client') }),
    );
    expect(client.total).toBeGreaterThan(0);
    expect(client.data.every((diary) => diary.status === 'APPROVED')).toBe(true);

    const engineer = await json<PaginatedResponse<SiteDiary>>(
      await callApi('/site-diaries?pageSize=500', { token: await tokenFor('engineer') }),
    );
    expect(new Set(engineer.data.map((diary) => diary.projectId))).toEqual(new Set(['prj-gthm', 'prj-cvmd', 'prj-sgg']));
  });

  it('luồng duyệt: kỹ sư lập nháp → gửi duyệt → PM phê duyệt; nhật ký đã duyệt bị khoá', async () => {
    const engineer = await tokenFor('engineer');
    const pm = await tokenFor('pm');
    const date = freeDate('prj-gthm');

    const created = await callApi('/site-diaries', { method: 'POST', token: engineer, body: JSON.stringify(newDiary('prj-gthm', date)) });
    expect(created.status).toBe(201);
    const draft = await json<SiteDiary>(created);
    expect(draft).toMatchObject({ status: 'DRAFT', totalWorkers: 12 });

    // Kỹ sư không được tự duyệt.
    expect((await callApi(`/site-diaries/${draft.id}/approve`, { method: 'POST', token: engineer })).status).toBe(403);
    // Chưa gửi thì chưa duyệt được.
    expect((await callApi(`/site-diaries/${draft.id}/approve`, { method: 'POST', token: pm })).status).toBe(409);

    const submitted = await json<SiteDiary>(await callApi(`/site-diaries/${draft.id}/submit`, { method: 'POST', token: engineer }));
    expect(submitted.status).toBe('SUBMITTED');
    // Đã gửi thì không sửa được.
    const locked = await callApi(`/site-diaries/${draft.id}`, { method: 'PUT', token: engineer, body: JSON.stringify(newDiary('prj-gthm', date)) });
    expect(locked.status).toBe(409);

    const approved = await json<SiteDiary>(
      await callApi(`/site-diaries/${draft.id}/approve`, { method: 'POST', token: pm, body: JSON.stringify({ note: 'Đạt' }) }),
    );
    expect(approved.status).toBe('APPROVED');
    expect(approved.history.map((entry) => entry.action)).toEqual(['CREATED', 'SUBMITTED', 'APPROVED']);
    expect(approved.history[2].by.id).toBe('usr-pm');
  });

  it('trả lại bắt buộc có lý do; bị trả lại thì sửa và gửi lại được', async () => {
    const engineer = await tokenFor('engineer');
    const pm = await tokenFor('pm');
    const draft = await json<SiteDiary>(
      await callApi('/site-diaries', { method: 'POST', token: engineer, body: JSON.stringify(newDiary('prj-cvmd', freeDate('prj-cvmd'))) }),
    );
    await callApi(`/site-diaries/${draft.id}/submit`, { method: 'POST', token: engineer });

    const noReason = await callApi(`/site-diaries/${draft.id}/reject`, { method: 'POST', token: pm, body: JSON.stringify({ note: ' ' }) });
    expect(noReason.status).toBe(422);

    const rejected = await json<SiteDiary>(
      await callApi(`/site-diaries/${draft.id}/reject`, {
        method: 'POST',
        token: pm,
        body: JSON.stringify({ note: 'Bổ sung ảnh nghiệm thu.' }),
      }),
    );
    expect(rejected).toMatchObject({ status: 'REJECTED', reviewNote: 'Bổ sung ảnh nghiệm thu.' });

    const edited = await callApi(`/site-diaries/${draft.id}`, {
      method: 'PUT',
      token: engineer,
      body: JSON.stringify({ ...newDiary('prj-cvmd', draft.date), notes: 'Đã bổ sung ảnh.' }),
    });
    expect(edited.status).toBe(200);
    const resubmitted = await json<SiteDiary>(await callApi(`/site-diaries/${draft.id}/submit`, { method: 'POST', token: engineer }));
    expect(resubmitted.status).toBe('SUBMITTED');
    expect(resubmitted.history.map((entry) => entry.action)).toEqual(['CREATED', 'SUBMITTED', 'REJECTED', 'UPDATED', 'SUBMITTED']);
  });

  it('trùng ngày → 409; ngày tương lai, dữ liệu sai → 422; dự án không được gán → 403; CLIENT → 403', async () => {
    const engineer = await tokenFor('engineer');
    const existing = db.siteDiaries.findOne((diary) => diary.projectId === 'prj-gthm');
    expect(existing).toBeDefined();
    const duplicate = await callApi('/site-diaries', {
      method: 'POST',
      token: engineer,
      body: JSON.stringify(newDiary('prj-gthm', existing?.date ?? '')),
    });
    expect(duplicate.status).toBe(409);

    const future = await callApi('/site-diaries', { method: 'POST', token: engineer, body: JSON.stringify(newDiary('prj-gthm', '2999-01-01')) });
    expect(future.status).toBe(422);

    const invalid = await callApi('/site-diaries', {
      method: 'POST',
      token: engineer,
      body: JSON.stringify({ ...newDiary('prj-gthm', freeDate('prj-gthm')), labor: [{ crew: '', headcount: -1 }] }),
    });
    expect(invalid.status).toBe(422);

    const notAssigned = await callApi('/site-diaries', {
      method: 'POST',
      token: engineer,
      body: JSON.stringify(newDiary('prj-nmqv', freeDate('prj-nmqv'))),
    });
    expect(notAssigned.status).toBe(403);

    const client = await callApi('/site-diaries', {
      method: 'POST',
      token: await tokenFor('client'),
      body: JSON.stringify(newDiary('prj-gthm', freeDate('prj-gthm'))),
    });
    expect(client.status).toBe(403);
  });

  it('chỉ xoá được bản nháp', async () => {
    const pm = await tokenFor('pm');
    const approved = db.siteDiaries.findOne((diary) => diary.status === 'APPROVED');
    expect((await callApi(`/site-diaries/${approved?.id}`, { method: 'DELETE', token: pm })).status).toBe(409);

    const draft = db.siteDiaries.findOne((diary) => diary.status === 'DRAFT');
    expect((await callApi(`/site-diaries/${draft?.id}`, { method: 'DELETE', token: pm })).status).toBe(204);
  });

  it('upload ảnh rồi tải lại qua /files/:id; ảnh seed trả về SVG minh hoạ', async () => {
    const uploaded = await callApi('/uploads', {
      method: 'POST',
      token: await tokenFor('engineer'),
      ...multipart('hien-truong.jpg', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
    });
    expect(uploaded.status).toBe(201);
    const file = await json<UploadedFile>(uploaded);
    expect(file.url).toBe(`/api/v1/files/${file.id}`);

    const downloaded = await callApi(`/files/${file.id}`);
    expect(downloaded.headers.get('Content-Type')).toBe('image/jpeg');
    expect((await downloaded.arrayBuffer()).byteLength).toBe(4);

    const seedPhoto = db.siteDiaries.all()[0].photos[0];
    const svg = await callApi(`/files/${seedPhoto.id}`);
    expect(svg.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(await svg.text()).toContain('<svg');
  });

  it('upload: CLIENT bị 403, sai định dạng bị 422', async () => {
    const text = multipart('note.txt', 'text/plain', new TextEncoder().encode('hello'));
    expect((await callApi('/uploads', { method: 'POST', token: await tokenFor('pm'), ...text })).status).toBe(422);

    const image = multipart('a.png', 'image/png', new Uint8Array([1]));
    expect((await callApi('/uploads', { method: 'POST', token: await tokenFor('client'), ...image })).status).toBe(403);
  });
});
