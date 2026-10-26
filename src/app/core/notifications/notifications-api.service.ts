import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ListParams } from '../../shared/models/api.model';
import { AppNotification, NotificationPage } from '../../shared/models/notification.model';
import { toHttpParams } from '../../shared/utils/http-params';

export interface NotificationListParams extends ListParams {
  readonly unreadOnly?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/notifications`;

  list(params: NotificationListParams = {}): Observable<NotificationPage> {
    return this.http.get<NotificationPage>(this.baseUrl, { params: toHttpParams(params) });
  }

  markRead(id: string, read = true): Observable<AppNotification> {
    return this.http.patch<AppNotification>(`${this.baseUrl}/${id}`, { read });
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/read-all`, null);
  }
}
