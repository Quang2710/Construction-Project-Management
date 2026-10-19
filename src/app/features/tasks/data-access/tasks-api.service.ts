import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import { Task, TaskComment, TaskCreateRequest, TaskListParams, TaskUpdateRequest } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tasks`;

  list(params: TaskListParams = {}): Observable<PaginatedResponse<Task>> {
    return this.http.get<PaginatedResponse<Task>>(this.baseUrl, { params: toHttpParams(params) });
  }

  get(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/${id}`);
  }

  create(body: TaskCreateRequest): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, body);
  }

  update(id: string, changes: TaskUpdateRequest): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  comments(id: string): Observable<TaskComment[]> {
    return this.http.get<TaskComment[]>(`${this.baseUrl}/${id}/comments`);
  }

  addComment(id: string, content: string): Observable<TaskComment> {
    return this.http.post<TaskComment>(`${this.baseUrl}/${id}/comments`, { content });
  }
}
