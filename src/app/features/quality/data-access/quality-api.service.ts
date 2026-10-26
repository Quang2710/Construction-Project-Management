import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import {
  ChecklistTemplate,
  Inspection,
  InspectionCreateRequest,
  InspectionListParams,
  InspectionUpdateRequest,
  PunchCreateRequest,
  PunchItem,
  PunchListParams,
  PunchTransition,
  PunchTransitionRequest,
} from '../models/quality.model';

export type InspectionDecision = 'approve' | 'reject';

@Injectable({ providedIn: 'root' })
export class QualityApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  templates(): Observable<ChecklistTemplate[]> {
    return this.http.get<ChecklistTemplate[]>(`${this.api}/quality/templates`);
  }

  inspections(params: InspectionListParams = {}): Observable<PaginatedResponse<Inspection>> {
    return this.http.get<PaginatedResponse<Inspection>>(`${this.api}/inspections`, { params: toHttpParams(params) });
  }

  inspection(id: string): Observable<Inspection> {
    return this.http.get<Inspection>(`${this.api}/inspections/${id}`);
  }

  createInspection(body: InspectionCreateRequest): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.api}/inspections`, body);
  }

  updateInspection(id: string, body: InspectionUpdateRequest): Observable<Inspection> {
    return this.http.put<Inspection>(`${this.api}/inspections/${id}`, body);
  }

  deleteInspection(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/inspections/${id}`);
  }

  submitInspection(id: string): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.api}/inspections/${id}/submit`, {});
  }

  decideInspection(id: string, decision: InspectionDecision, note: string): Observable<Inspection> {
    return this.http.post<Inspection>(`${this.api}/inspections/${id}/${decision}`, { note });
  }

  punchItems(params: PunchListParams = {}): Observable<PaginatedResponse<PunchItem>> {
    return this.http.get<PaginatedResponse<PunchItem>>(`${this.api}/punch-items`, { params: toHttpParams(params) });
  }

  punchItem(id: string): Observable<PunchItem> {
    return this.http.get<PunchItem>(`${this.api}/punch-items/${id}`);
  }

  createPunchItem(body: PunchCreateRequest): Observable<PunchItem> {
    return this.http.post<PunchItem>(`${this.api}/punch-items`, body);
  }

  reassignPunchItem(id: string, body: { readonly assigneeId: string; readonly dueDate: string }): Observable<PunchItem> {
    return this.http.patch<PunchItem>(`${this.api}/punch-items/${id}`, body);
  }

  transitionPunchItem(id: string, transition: PunchTransition, body: PunchTransitionRequest): Observable<PunchItem> {
    return this.http.post<PunchItem>(`${this.api}/punch-items/${id}/${transition}`, body);
  }
}
