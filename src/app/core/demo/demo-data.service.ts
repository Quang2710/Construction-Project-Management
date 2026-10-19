import { HttpClient } from '@angular/common/http';
import { DOCUMENT, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Tiện ích chỉ dùng khi chạy fake BE (environment.useMocks). */
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  readonly enabled = environment.useMocks;

  /** Khôi phục dữ liệu demo ban đầu rồi tải lại trang. */
  async reset(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${environment.apiBaseUrl}/__demo/reset`, null));
    this.document.location.reload();
  }
}
