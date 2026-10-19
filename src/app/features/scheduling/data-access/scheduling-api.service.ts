import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WbsCreateRequest, WbsNode } from '../models/wbs.model';

@Injectable({ providedIn: 'root' })
export class SchedulingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  wbs(projectId: string): Observable<WbsNode[]> {
    return this.http.get<WbsNode[]>(`${this.baseUrl}/${projectId}/wbs`);
  }

  createWbs(projectId: string, body: WbsCreateRequest): Observable<WbsNode> {
    return this.http.post<WbsNode>(`${this.baseUrl}/${projectId}/wbs`, body);
  }
}
