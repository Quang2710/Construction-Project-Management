import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import { DiaryContent, DiaryCreateRequest, DiaryListParams, SiteDiary } from '../models/site-diary.model';

@Injectable({ providedIn: 'root' })
export class SiteDiariesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/site-diaries`;

  list(params: DiaryListParams = {}): Observable<PaginatedResponse<SiteDiary>> {
    return this.http.get<PaginatedResponse<SiteDiary>>(this.baseUrl, { params: toHttpParams(params) });
  }

  get(id: string): Observable<SiteDiary> {
    return this.http.get<SiteDiary>(`${this.baseUrl}/${id}`);
  }

  create(body: DiaryCreateRequest): Observable<SiteDiary> {
    return this.http.post<SiteDiary>(this.baseUrl, body);
  }

  update(id: string, body: DiaryContent): Observable<SiteDiary> {
    return this.http.put<SiteDiary>(`${this.baseUrl}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  submit(id: string): Observable<SiteDiary> {
    return this.http.post<SiteDiary>(`${this.baseUrl}/${id}/submit`, null);
  }

  approve(id: string, note: string): Observable<SiteDiary> {
    return this.http.post<SiteDiary>(`${this.baseUrl}/${id}/approve`, { note });
  }

  reject(id: string, note: string): Observable<SiteDiary> {
    return this.http.post<SiteDiary>(`${this.baseUrl}/${id}/reject`, { note });
  }
}
