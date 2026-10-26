import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, Observable, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkStatusService } from './network-status.service';
import { OfflineCacheService, tokenSubject } from './offline-cache.service';

/** Header đánh dấu response lấy từ cache offline (giá trị: thời điểm cache). */
export const OFFLINE_CACHE_HEADER = 'X-Offline-Cache';

/** Không cache: file nhị phân (ảnh, PDF) và API chỉ có ở fake BE. */
const EXCLUDED_PREFIXES = [`${environment.apiBaseUrl}/files/`, `${environment.apiBaseUrl}/__demo/`];

/**
 * Network-first cho GET API: thành công thì lưu lại; mất mạng (status 0) thì trả bản đã lưu.
 * Đặt cuối chuỗi interceptor (gần BE nhất) để errorInterceptor không báo "mất kết nối"
 * khi đã có dữ liệu cache thay thế.
 */
export const offlineCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const authorization = req.headers.get('Authorization') ?? '';
  const subject = authorization.startsWith('Bearer ') ? tokenSubject(authorization.slice(7)) : null;
  const cacheable =
    req.method === 'GET' &&
    req.responseType === 'json' &&
    req.url.startsWith(environment.apiBaseUrl) &&
    !EXCLUDED_PREFIXES.some((prefix) => req.url.startsWith(prefix)) &&
    subject !== null;
  if (!cacheable) {
    return next(req);
  }

  const cache = inject(OfflineCacheService);
  const network = inject(NetworkStatusService);
  const key = `${subject}|${req.urlWithParams}`;

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        void cache.put(key, event.body);
        network.markFresh();
      }
    }),
    catchError((error: unknown): Observable<HttpResponse<unknown>> => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 0) {
        return throwError(() => error);
      }
      return from(cache.get(key)).pipe(
        switchMap((cached) => {
          if (!cached) {
            return throwError(() => error);
          }
          network.markServedFromCache(cached.cachedAt);
          return [
            new HttpResponse({
              body: cached.body,
              status: 200,
              statusText: 'OK (offline cache)',
              url: req.urlWithParams,
              headers: new HttpHeaders({ [OFFLINE_CACHE_HEADER]: cached.cachedAt }),
            }),
          ];
        }),
      );
    }),
  );
};
