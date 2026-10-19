import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toApiError } from '../../shared/utils/api-error';
import { AuthStore } from '../auth/auth.store';
import { NotificationService } from '../notifications/notification.service';

const AUTH_URL_PREFIX = `${environment.apiBaseUrl}/auth/`;

/**
 * Xử lý lỗi chung:
 * - 401: xoá phiên, quay về trang đăng nhập (trừ chính các API /auth/* — AuthStore tự xử lý).
 * - 403: thông báo không đủ quyền.
 * - 0: mất kết nối.
 * Lỗi vẫn được ném tiếp để màn hình hiển thị error state.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !req.url.startsWith(AUTH_URL_PREFIX)) {
        if (error.status === 401 && auth.isAuthenticated()) {
          auth.clearSession();
          notification.error(toApiError(error).message);
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        } else if (error.status === 403 || error.status === 0) {
          notification.error(toApiError(error).message);
        }
      }
      return throwError(() => error);
    }),
  );
};
