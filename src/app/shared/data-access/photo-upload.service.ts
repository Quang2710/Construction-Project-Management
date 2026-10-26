import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Photo } from '../models/photo.model';
import { getCurrentPosition } from '../utils/geo.utils';
import { compressImage } from '../utils/image.utils';
import { UploadsApiService } from './uploads-api.service';

/** Nén + tải ảnh hiện trường lên, gắn vị trí GPS (một lần cho cả lượt chọn). */
@Injectable({ providedIn: 'root' })
export class PhotoUploadService {
  private readonly uploads = inject(UploadsApiService);

  async uploadAll(files: readonly File[], caption = ''): Promise<Photo[]> {
    if (files.length === 0) {
      return [];
    }
    const geo = await getCurrentPosition();
    const location = geo.ok ? geo.position : null;
    return Promise.all(
      files.map(async (file) => {
        const compressed = await compressImage(file);
        const fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        const uploaded = await firstValueFrom(this.uploads.upload(compressed, fileName));
        return {
          id: uploaded.id,
          url: uploaded.url,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          caption,
          takenAt: new Date(file.lastModified || Date.now()).toISOString(),
          location,
        };
      }),
    );
  }
}
