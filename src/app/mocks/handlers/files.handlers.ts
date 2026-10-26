import { http, HttpResponse } from 'msw';
import { UploadedFile } from '../../shared/models/upload.model';
import { db } from '../db';
import { fileStore } from '../file-store';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, simulateNetwork } from '../utils/http.utils';
import { buildDrawingPdf } from '../utils/drawing-pdf';
import { placeholderPhotoSvg } from '../utils/placeholder-image';
import { newId } from '../utils/serializers';

const MB = 1024 * 1024;
/** Giới hạn dung lượng theo loại tệp: ảnh hiện trường đã nén ở client, bản vẽ PDF thường lớn hơn. */
const MAX_SIZES: Readonly<Record<string, number>> = {
  'image/jpeg': 10 * MB,
  'image/png': 10 * MB,
  'image/webp': 10 * MB,
  'application/pdf': 20 * MB,
};

/** Không dùng instanceof Blob: File có thể đến từ realm khác (worker, jsdom, undici). */
function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).size === 'number' &&
    typeof (value as Blob).type === 'string'
  );
}

function svgResponse(id: string, caption: string, projectId: string, isoDate: string): HttpResponse<string> {
  const project = db.projects.findById(projectId);
  const svg = placeholderPhotoSvg(id, caption, `${project?.code ?? ''} · ${isoDate.slice(0, 10).split('-').reverse().join('/')}`);
  return new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' } });
}

/** Ảnh seed (nhật ký, punch list) không có file thật: vẽ ảnh minh hoạ SVG. */
function seedPhoto(id: string): HttpResponse<string> | null {
  for (const diary of db.siteDiaries.all()) {
    const photo = diary.photos.find((item) => item.id === id);
    if (photo) {
      return svgResponse(id, photo.caption, diary.projectId, diary.date);
    }
  }
  for (const punch of db.punchItems.all()) {
    const photo = [...punch.beforePhotos, ...punch.afterPhotos].find((item) => item.id === id);
    if (photo) {
      return svgResponse(id, photo.caption, punch.projectId, photo.takenAt);
    }
  }
  return null;
}

/** Bản vẽ seed: sinh PDF minh hoạ theo phiên bản. */
function seedDrawing(id: string): HttpResponse<ArrayBuffer> | null {
  for (const drawing of db.drawings.all()) {
    const index = drawing.revisions.findIndex((revision) => revision.file.fileId === id);
    if (index >= 0) {
      const revision = drawing.revisions[index];
      const project = db.projects.findById(drawing.projectId);
      const bytes = buildDrawingPdf({
        projectCode: project?.code ?? '',
        projectName: project?.name ?? '',
        code: drawing.code,
        title: drawing.title,
        discipline: drawing.discipline,
        revisionIndex: index,
        revision: revision.revision,
        issuedAt: revision.issuedAt,
      });
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return new HttpResponse(body, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'max-age=3600' } });
    }
  }
  return null;
}

export const filesHandlers = [
  /** Fake upload: lưu Blob vào IndexedDB, trả về URL do chính fake BE phục vụ. */
  http.post(apiUrl('/uploads'), async ({ request }) => {
    const failure = await simulateNetwork();
    if (failure) {
      return failure;
    }
    const auth = authenticate(request);
    if (!auth.ok) {
      return auth.response;
    }
    if (auth.user.role === 'CLIENT') {
      return errorResponse(403, 'FORBIDDEN', 'Bạn không có quyền tải tệp lên.');
    }

    let file: FormDataEntryValue | null = null;
    try {
      file = (await request.formData()).get('file');
    } catch {
      return errorResponse(400, 'BAD_REQUEST', 'Yêu cầu tải lên không hợp lệ.');
    }
    if (!isBlobLike(file)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Thiếu tệp tải lên (field "file").');
    }
    const maxSize = MAX_SIZES[file.type];
    if (maxSize === undefined) {
      return errorResponse(422, 'UNSUPPORTED_FILE_TYPE', 'Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc tệp PDF.');
    }
    if (file.size > maxSize) {
      return errorResponse(422, 'FILE_TOO_LARGE', `Tệp vượt quá ${maxSize / MB} MB.`);
    }

    const id = newId('file');
    const fileName = 'name' in file && typeof file.name === 'string' ? file.name : `${id}.jpg`;
    await fileStore.put({ id, blob: file, fileName, mimeType: file.type, size: file.size, createdAt: new Date().toISOString() });
    const body: UploadedFile = { id, url: apiUrl(`/files/${id}`), fileName, mimeType: file.type, size: file.size };
    return HttpResponse.json(body, { status: 201 });
  }),

  /** Công khai (thẻ <img> không gửi kèm token); id ngẫu nhiên đóng vai trò khoá truy cập. */
  http.get(apiUrl('/files/:id'), async ({ params }) => {
    const id = String(params['id']);
    if (id.startsWith('seed-drw-')) {
      return seedDrawing(id) ?? errorResponse(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
    }
    if (id.startsWith('seed-')) {
      return seedPhoto(id) ?? errorResponse(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
    }
    const stored = await fileStore.get(id);
    if (!stored) {
      return errorResponse(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
    }
    return new HttpResponse(stored.blob, {
      headers: { 'Content-Type': stored.mimeType, 'Cache-Control': 'max-age=3600' },
    });
  }),
];
