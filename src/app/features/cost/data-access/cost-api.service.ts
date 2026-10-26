import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import {
  ChangeOrder,
  ChangeOrderCreate,
  CostEntry,
  CostEntryCreate,
  CostEntryListParams,
  CostSummary,
  PaymentMilestone,
  PaymentUpdateRequest,
  ProfitLossRow,
} from '../models/cost.model';

export type ChangeOrderDecision = 'approve' | 'reject';

@Injectable({ providedIn: 'root' })
export class CostApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  summary(projectId: string): Observable<CostSummary> {
    return this.http.get<CostSummary>(`${this.api}/projects/${projectId}/cost-summary`);
  }

  /** Lãi/lỗ toàn danh mục dự án (chỉ ADMIN, PROJECT_MANAGER). */
  overview(): Observable<ProfitLossRow[]> {
    return this.http.get<ProfitLossRow[]>(`${this.api}/cost/overview`);
  }

  entries(projectId: string, params: CostEntryListParams = {}): Observable<PaginatedResponse<CostEntry>> {
    return this.http.get<PaginatedResponse<CostEntry>>(`${this.api}/projects/${projectId}/cost-entries`, {
      params: toHttpParams(params),
    });
  }

  createEntry(projectId: string, body: CostEntryCreate): Observable<CostEntry> {
    return this.http.post<CostEntry>(`${this.api}/projects/${projectId}/cost-entries`, body);
  }

  changeOrders(projectId: string): Observable<ChangeOrder[]> {
    return this.http.get<ChangeOrder[]>(`${this.api}/projects/${projectId}/change-orders`);
  }

  createChangeOrder(projectId: string, body: ChangeOrderCreate): Observable<ChangeOrder> {
    return this.http.post<ChangeOrder>(`${this.api}/projects/${projectId}/change-orders`, body);
  }

  decideChangeOrder(id: string, decision: ChangeOrderDecision, note: string): Observable<ChangeOrder> {
    return this.http.post<ChangeOrder>(`${this.api}/change-orders/${id}/${decision}`, { note });
  }

  payments(projectId: string): Observable<PaymentMilestone[]> {
    return this.http.get<PaymentMilestone[]>(`${this.api}/projects/${projectId}/payments`);
  }

  updatePayment(id: string, body: PaymentUpdateRequest): Observable<PaymentMilestone> {
    return this.http.patch<PaymentMilestone>(`${this.api}/payments/${id}`, body);
  }
}
