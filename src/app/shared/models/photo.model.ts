export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
  /** Sai số (m) do Geolocation API trả về. */
  readonly accuracy: number | null;
}

/** Ảnh hiện trường đã tải lên (nhật ký, punch list...). */
export interface Photo {
  readonly id: string;
  /** URL tải ảnh (fake BE phục vụ từ IndexedDB). */
  readonly url: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly caption: string;
  readonly takenAt: string;
  readonly location: GeoPoint | null;
}
