import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import { Drawing, DrawingCreateRequest, DrawingListParams, RevisionCreateRequest } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  drawings(projectId: string, params: DrawingListParams = {}): Observable<PaginatedResponse<Drawing>> {
    return this.http.get<PaginatedResponse<Drawing>>(`${this.api}/projects/${projectId}/drawings`, { params: toHttpParams(params) });
  }

  drawing(id: string): Observable<Drawing> {
    return this.http.get<Drawing>(`${this.api}/drawings/${id}`);
  }

  createDrawing(projectId: string, body: DrawingCreateRequest): Observable<Drawing> {
    return this.http.post<Drawing>(`${this.api}/projects/${projectId}/drawings`, body);
  }

  addRevision(drawingId: string, body: RevisionCreateRequest): Observable<Drawing> {
    return this.http.post<Drawing>(`${this.api}/drawings/${drawingId}/revisions`, body);
  }

  /** Nội dung PDF của một phiên bản (URL do BE trả về trong DrawingFile). */
  fileBytes(url: string): Observable<ArrayBuffer> {
    return this.http.get(url, { responseType: 'arraybuffer' });
  }
}
