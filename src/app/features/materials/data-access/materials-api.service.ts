import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../shared/models/api.model';
import { toHttpParams } from '../../../shared/utils/http-params';
import {
  Material,
  MaterialListParams,
  MaterialRequest,
  MaterialRequestCreate,
  MaterialRequestListParams,
  MaterialUpsertRequest,
  StockItem,
  StockListParams,
  StockTransaction,
  StockTransactionRequest,
  TransactionListParams,
} from '../models/material.model';

export type MaterialRequestAction = 'approve' | 'reject' | 'receive';

@Injectable({ providedIn: 'root' })
export class MaterialsApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  materials(params: MaterialListParams = {}): Observable<PaginatedResponse<Material>> {
    return this.http.get<PaginatedResponse<Material>>(`${this.api}/materials`, { params: toHttpParams(params) });
  }

  materialByCode(code: string): Observable<Material> {
    return this.http.get<Material>(`${this.api}/materials/by-code/${encodeURIComponent(code)}`);
  }

  createMaterial(body: MaterialUpsertRequest): Observable<Material> {
    return this.http.post<Material>(`${this.api}/materials`, body);
  }

  updateMaterial(id: string, body: MaterialUpsertRequest): Observable<Material> {
    return this.http.put<Material>(`${this.api}/materials/${id}`, body);
  }

  stock(params: StockListParams = {}): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(`${this.api}/stock`, { params: toHttpParams(params) });
  }

  setMinQuantity(projectId: string, materialId: string, minQuantity: number): Observable<StockItem> {
    return this.http.put<StockItem>(`${this.api}/stock/${projectId}/${materialId}`, { minQuantity });
  }

  transactions(params: TransactionListParams = {}): Observable<PaginatedResponse<StockTransaction>> {
    return this.http.get<PaginatedResponse<StockTransaction>>(`${this.api}/stock-transactions`, {
      params: toHttpParams(params),
    });
  }

  createTransaction(body: StockTransactionRequest): Observable<StockTransaction> {
    return this.http.post<StockTransaction>(`${this.api}/stock-transactions`, body);
  }

  requests(params: MaterialRequestListParams = {}): Observable<PaginatedResponse<MaterialRequest>> {
    return this.http.get<PaginatedResponse<MaterialRequest>>(`${this.api}/material-requests`, {
      params: toHttpParams(params),
    });
  }

  createRequest(body: MaterialRequestCreate): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.api}/material-requests`, body);
  }

  actOnRequest(id: string, action: MaterialRequestAction, note: string): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.api}/material-requests/${id}/${action}`, { note });
  }
}
