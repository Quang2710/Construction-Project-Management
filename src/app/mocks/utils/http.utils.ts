import { delay, HttpResponse } from 'msw';
import { environment } from '../../../environments/environment';
import { MockSettings } from '../../../environments/environment.model';
import { ApiError } from '../../shared/models/api.model';

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

/** Cấu hình runtime của fake BE (unit test có thể tắt độ trễ). */
export const mockSettings: { -readonly [K in keyof MockSettings]: MockSettings[K] } = { ...environment.mock };

/** Ghép đường dẫn API, ví dụ apiUrl('/auth/login') -> '/api/v1/auth/login'. */
export function apiUrl(path: string): string {
  return `${environment.apiBaseUrl}${path}`;
}

export function errorResponse(status: ErrorStatus, code: string, message: string): HttpResponse<ApiError> {
  return HttpResponse.json<ApiError>({ code, message }, { status });
}

/**
 * Giả lập độ trễ mạng 200–800ms, mất mạng khi trình duyệt offline (DevTools > Offline)
 * và (tuỳ cờ environment) lỗi 500 ngẫu nhiên.
 * Trả về response lỗi nếu request "thất bại", ngược lại trả về null.
 */
export async function simulateNetwork(): Promise<HttpResponse<ApiError> | null> {
  // MSW trả lời ngay trong trình duyệt nên vẫn "có mạng" khi máy offline; giả lập như BE thật không với tới được.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return HttpResponse.error() as HttpResponse<ApiError>;
  }
  const { minDelayMs, maxDelayMs, randomErrors, errorRate } = mockSettings;
  await delay(Math.round(minDelayMs + Math.random() * (maxDelayMs - minDelayMs)));
  if (randomErrors && Math.random() < errorRate) {
    return errorResponse(500, 'INTERNAL_ERROR', 'Máy chủ đang gặp sự cố (lỗi giả lập). Vui lòng thử lại.');
  }
  return null;
}

/** Đọc body JSON an toàn: body lỗi cú pháp trả về null thay vì ném lỗi. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
