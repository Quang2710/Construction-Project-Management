import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ListParams, PaginatedResponse } from '../models/api.model';
import { User, UserRole } from '../models/user.model';
import { toHttpParams } from '../utils/http-params';

export interface UserListParams extends ListParams {
  readonly role?: UserRole | null;
  readonly active?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  list(params: UserListParams = {}): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(this.baseUrl, { params: toHttpParams(params) });
  }
}
