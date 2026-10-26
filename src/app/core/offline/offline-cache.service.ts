import { Injectable } from '@angular/core';
import { createKeyValueStore } from '../../shared/utils/idb-store';

export interface CachedResponse {
  readonly body: unknown;
  readonly cachedAt: string;
}

/** Giữ tối đa chừng này response; vượt thì xoá bớt các bản cũ nhất. */
const MAX_ENTRIES = 400;
const PRUNE_EVERY_WRITES = 50;

/**
 * Cache response GET của API để xem lại khi mất mạng (theo từng người dùng).
 * Không dùng dataGroups của ngsw: với fake BE, request /api do MSW trả lời nên ngsw không thấy;
 * và cache ở đây xoá được khi đăng xuất (Cache Storage của ngsw không biết phiên đăng nhập).
 */
@Injectable({ providedIn: 'root' })
export class OfflineCacheService {
  private readonly store = createKeyValueStore<CachedResponse>('http-cache');
  private writes = 0;

  async get(key: string): Promise<CachedResponse | undefined> {
    try {
      return await this.store.get(key);
    } catch {
      return undefined;
    }
  }

  async put(key: string, body: unknown): Promise<void> {
    try {
      await this.store.set(key, { body, cachedAt: new Date().toISOString() });
      this.writes += 1;
      if (this.writes % PRUNE_EVERY_WRITES === 0) {
        await this.prune();
      }
    } catch {
      // Hết dung lượng / bị chặn: bỏ qua, app vẫn chạy online bình thường.
    }
  }

  async clear(): Promise<void> {
    try {
      await this.store.clear();
    } catch {
      // Không xoá được thì thôi, dữ liệu vẫn theo khoá người dùng.
    }
  }

  private async prune(): Promise<void> {
    const entries = await this.store.entries();
    if (entries.length <= MAX_ENTRIES) {
      return;
    }
    const oldest = entries.sort(([, a], [, b]) => a.cachedAt.localeCompare(b.cachedAt)).slice(0, entries.length - MAX_ENTRIES);
    await Promise.all(oldest.map(([key]) => this.store.delete(key)));
  }
}

/** Lấy `sub` (id người dùng) từ JWT để tách cache theo người dùng; null nếu token không đọc được. */
export function tokenSubject(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='));
    const parsed: unknown = JSON.parse(json);
    const sub = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>)['sub'] : undefined;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}
