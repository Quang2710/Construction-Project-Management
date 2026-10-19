import { http, HttpResponse } from 'msw';
import { db } from '../db';
import { fileStore } from '../file-store';
import { apiUrl } from '../utils/http.utils';

/** Endpoint chỉ tồn tại ở fake BE: khôi phục dữ liệu demo ban đầu (kể cả ảnh đã tải lên). */
export const demoHandlers = [
  http.post(apiUrl('/__demo/reset'), async () => {
    db.reset();
    await fileStore.clear();
    return new HttpResponse(null, { status: 204 });
  }),
];
