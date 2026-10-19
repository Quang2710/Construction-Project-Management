import { http, HttpResponse } from 'msw';
import { UploadedFile } from '../../shared/models/upload.model';
import { db } from '../db';
import { fileStore } from '../file-store';
import { authenticate } from '../utils/auth.utils';
import { apiUrl, errorResponse, simulateNetwork } from '../utils/http.utils';
import { placeholderPhotoSvg } from '../utils/placeholder-image';
import { newId } from '../utils/serializers';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

function seedPhoto(id: string): HttpResponse<string> | null {
  for (const diary of db.siteDiaries.all()) {
    const photo = diary.photos.find((item) => item.id === id);
    if (photo) {
      const project = db.projects.findById(diary.projectId);
      const svg = placeholderPhotoSvg(id, photo.caption, `${project?.code ?? ''} · ${diary.date.split('-').reverse().join('/')}`);
      return new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' } });
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
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse(422, 'UNSUPPORTED_FILE_TYPE', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
    }
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(422, 'FILE_TOO_LARGE', 'Ảnh vượt quá 10 MB.');
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
