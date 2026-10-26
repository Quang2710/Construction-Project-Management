import { environment } from '../../../environments/environment';
import { GeoPoint, Photo } from '../../shared/models/photo.model';

/** Kiểm tra dữ liệu đầu vào dùng chung cho các handler (giống validation của BE thật). */

const FILE_URL_PREFIX = `${environment.apiBaseUrl}/files/`;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isText(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

export function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Kiểm tra từng phần tử của mảng; trả về null nếu có phần tử sai. */
export function parseList<T>(value: unknown, max: number, parse: (item: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) {
    return null;
  }
  const result: T[] = [];
  for (const item of value) {
    const parsed = isRecord(item) ? parse(item) : null;
    if (!parsed) {
      return null;
    }
    result.push(parsed);
  }
  return result;
}

export function parseLocation(value: unknown): GeoPoint | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value) || !isNumberInRange(value['lat'], -90, 90) || !isNumberInRange(value['lng'], -180, 180)) {
    return undefined;
  }
  const accuracy = value['accuracy'];
  return { lat: value['lat'], lng: value['lng'], accuracy: typeof accuracy === 'number' ? accuracy : null };
}

export function parsePhoto(item: Record<string, unknown>): Photo | null {
  const location = parseLocation(item['location']);
  if (
    location === undefined ||
    !isText(item['id'], 1, 100) ||
    typeof item['url'] !== 'string' ||
    !item['url'].startsWith(FILE_URL_PREFIX) ||
    !isText(item['fileName'], 1, 255) ||
    !isText(item['mimeType'], 1, 100) ||
    !isNumberInRange(item['size'], 0, 50 * 1024 * 1024) ||
    typeof item['takenAt'] !== 'string'
  ) {
    return null;
  }
  return {
    id: item['id'],
    url: item['url'],
    fileName: item['fileName'],
    mimeType: item['mimeType'],
    size: item['size'],
    caption: typeof item['caption'] === 'string' ? item['caption'].trim().slice(0, 200) : '',
    takenAt: item['takenAt'],
    location,
  };
}
