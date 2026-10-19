import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, isApiError } from '../models/api.model';

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng.',
  400: 'Yêu cầu không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu.',
  409: 'Dữ liệu bị xung đột. Vui lòng tải lại và thử lại.',
  422: 'Dữ liệu không hợp lệ.',
};

/** Chuẩn hoá mọi lỗi (HTTP, mạng, runtime) về dạng ApiError để hiển thị. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    if (isApiError(error.error)) {
      return error.error;
    }
    return {
      code: `HTTP_${error.status}`,
      message: STATUS_MESSAGES[error.status] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
    };
  }
  return { code: 'UNKNOWN', message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' };
}
