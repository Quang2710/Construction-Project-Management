import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import { Project, ProjectListParams, ProjectUpsertRequest } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  list(params: ProjectListParams = {}): Observable<PaginatedResponse<Project>> {
    return this.http.get<PaginatedResponse<Project>>(this.baseUrl, { params: toHttpParams(params) });
  }

  get(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${id}`);
  }

  members(id: string): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.baseUrl}/${id}/members`);
  }

  create(body: ProjectUpsertRequest): Observable<Project> {
    return this.http.post<Project>(this.baseUrl, body);
  }

  update(id: string, body: ProjectUpsertRequest): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
