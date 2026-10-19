/** Kết quả POST /uploads (multipart/form-data, field "file"). */
export interface UploadedFile {
  readonly id: string;
  readonly url: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}
