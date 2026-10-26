import { Injectable } from '@angular/core';
import { compressImage } from '../utils/image.utils';

/** Bọc compressImage để thay được trong unit test (jsdom không giải mã ảnh). */
@Injectable({ providedIn: 'root' })
export class ImageCompressor {
  compress(file: Blob): Promise<Blob> {
    return compressImage(file);
  }
}
