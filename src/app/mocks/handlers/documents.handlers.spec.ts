import { Drawing } from '../../features/documents/models/document.model';
import { PaginatedResponse } from '../../shared/models/api.model';
import { db } from '../db';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';
import { buildDrawingPdf } from '../utils/drawing-pdf';

const PROJECT = 'prj-gthm';
const MINIMAL_PDF = '%PDF-1.4\n%%EOF\n';

async function uploadPdf(token: string, name = 'KT-999.pdf', type = 'application/pdf'): Promise<{ fileId: string; fileName: string; size: number }> {
  const form = new FormData();
  form.append('file', new File([MINIMAL_PDF], name, { type }));
  const response = await callApi('/uploads', { method: 'POST', token, body: form });
  const uploaded = await json<{ id: string; fileName: string; size: number }>(response);
  return { fileId: uploaded.id, fileName: uploaded.fileName, size: uploaded.size };
}

describe('Fake BE: bản vẽ', () => {
  beforeEach(() => resetMockBackend());

  it('seed có bản vẽ nhiều phiên bản theo bộ môn; mọi role đều xem được', async () => {
    const client = await tokenFor('client');
    const list = await json<PaginatedResponse<Drawing>>(await callApi(`/projects/${PROJECT}/drawings?pageSize=100`, { token: client }));
    expect(new Set(list.data.map((drawing) => drawing.discipline))).toEqual(new Set(['ARCH', 'STRUCT', 'MEP']));
    expect(list.data.some((drawing) => drawing.revisions.length >= 2)).toBe(true);
    const drawing = list.data[0];
    expect(drawing.currentRevision).toEqual(drawing.revisions[drawing.revisions.length - 1]);

    const filtered = await json<PaginatedResponse<Drawing>>(await callApi(`/projects/${PROJECT}/drawings?discipline=MEP&q=điện`, { token: client }));
    expect(filtered.data.length).toBeGreaterThan(0);
    expect(filtered.data.every((item) => item.discipline === 'MEP')).toBe(true);
  });

  it('PDF seed hợp lệ: bảng xref trỏ đúng vị trí từng object, phiên bản sau khác phiên bản trước', async () => {
    const drawing = db.drawings.findOne((item) => item.revisions.length >= 2);
    const response = await callApi(`/files/${drawing?.revisions[0].file.fileId}`);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    const text = new TextDecoder().decode(await response.arrayBuffer());
    expect(text.startsWith('%PDF-1.4')).toBe(true);

    const xrefAt = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, index) => expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true));
    const length = Number(/\/Length (\d+)/.exec(text)?.[1]);
    const streamStart = text.indexOf('stream\n') + 'stream\n'.length;
    expect(text.slice(streamStart + length, streamStart + length + '\nendstream'.length)).toBe('\nendstream');

    const spec = { projectCode: 'P', projectName: 'Dự án Đông Hà', code: 'KT-101', title: 'Mặt bằng', discipline: 'ARCH' as const, revision: 'A', issuedAt: '2026-01-01' };
    const a = new TextDecoder().decode(buildDrawingPdf({ ...spec, revisionIndex: 0 }));
    const c = new TextDecoder().decode(buildDrawingPdf({ ...spec, revisionIndex: 2, revision: 'C' }));
    expect(c.length).toBeGreaterThan(a.length);
    expect(c).toContain('CAU THANG BO CT2');
    // Chữ tiếng Việt được bỏ dấu (font chuẩn PDF không có glyph).
    expect(a).toContain('Du an Dong Ha');
  });

  it('PM tải lên bản vẽ mới (A) rồi phiên bản mới (B); trùng số hiệu → 409', async () => {
    const pm = await tokenFor('pm');
    const file = await uploadPdf(pm);
    const created = await callApi(`/projects/${PROJECT}/drawings`, {
      method: 'POST',
      token: pm,
      body: JSON.stringify({ code: 'kt-999', title: 'Mặt bằng sân thượng', discipline: 'ARCH', description: '', file }),
    });
    expect(created.status).toBe(201);
    const drawing = await json<Drawing>(created);
    expect(drawing).toMatchObject({ code: 'KT-999', currentRevision: { revision: 'A' } });

    const duplicate = await callApi(`/projects/${PROJECT}/drawings`, {
      method: 'POST',
      token: pm,
      body: JSON.stringify({ code: 'KT-999', title: 'Trùng', discipline: 'ARCH', description: '', file }),
    });
    expect(duplicate.status).toBe(409);

    const noNote = await callApi(`/drawings/${drawing.id}/revisions`, { method: 'POST', token: pm, body: JSON.stringify({ description: '', file }) });
    expect(noNote.status).toBe(422);
    const revised = await json<Drawing>(
      await callApi(`/drawings/${drawing.id}/revisions`, {
        method: 'POST',
        token: pm,
        body: JSON.stringify({ description: 'Dời bể nước mái', file: await uploadPdf(pm, 'KT-999_B.pdf') }),
      }),
    );
    expect(revised.revisions.map((revision) => revision.revision)).toEqual(['A', 'B']);
    expect(revised.currentRevision.description).toBe('Dời bể nước mái');
  });

  it('chỉ chấp nhận file PDF đã tải lên; kỹ sư và CLIENT không tải lên được', async () => {
    const pm = await tokenFor('pm');
    const image = await uploadPdf(pm, 'anh.png', 'image/png');
    const notPdf = await callApi(`/projects/${PROJECT}/drawings`, {
      method: 'POST',
      token: pm,
      body: JSON.stringify({ code: 'KT-998', title: 'Ảnh', discipline: 'ARCH', description: '', file: image }),
    });
    expect(notPdf.status).toBe(422);
    const fake = await callApi(`/projects/${PROJECT}/drawings`, {
      method: 'POST',
      token: pm,
      body: JSON.stringify({ code: 'KT-998', title: 'Ma', discipline: 'ARCH', description: '', file: { fileId: 'khong-ton-tai', fileName: 'x.pdf', size: 10 } }),
    });
    expect(fake.status).toBe(422);

    for (const role of ['engineer', 'client'] as const) {
      const response = await callApi(`/projects/${PROJECT}/drawings`, { method: 'POST', token: await tokenFor(role), body: '{}' });
      expect(response.status).toBe(403);
    }
  });
});
