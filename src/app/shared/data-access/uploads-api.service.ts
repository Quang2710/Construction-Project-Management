import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UploadedFile } from '../models/upload.model';

@Injectable({ providedIn: 'root' })
export class UploadsApiService {
  private readonly http = inject(HttpClient);

  /** POST multipart/form-data, field "file". */
  upload(file: Blob, fileName: string): Observable<UploadedFile> {
    const body = new FormData();
    body.append('file', file, fileName);
    return this.http.post<UploadedFile>(`${environment.apiBaseUrl}/uploads`, body);
  }
}
