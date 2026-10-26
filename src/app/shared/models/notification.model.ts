import { PaginatedResponse } from './api.model';

export const NOTIFICATION_TYPES = ['DIARY', 'QUALITY', 'PUNCH', 'MATERIAL', 'DOCUMENT', 'SCHEDULE', 'WEATHER', 'SYSTEM'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_ICONS: Readonly<Record<NotificationType, string>> = {
  DIARY: 'menu_book',
  QUALITY: 'fact_check',
  PUNCH: 'report',
  MATERIAL: 'inventory_2',
  DOCUMENT: 'draw',
  SCHEDULE: 'event_upcoming',
  WEATHER: 'thunderstorm',
  SYSTEM: 'info',
};

export const NOTIFICATION_TYPE_LABELS: Readonly<Record<NotificationType, string>> = {
  DIARY: 'Nhật ký',
  QUALITY: 'Nghiệm thu',
  PUNCH: 'Punch list',
  MATERIAL: 'Vật tư',
  DOCUMENT: 'Bản vẽ',
  SCHEDULE: 'Tiến độ',
  WEATHER: 'Thời tiết',
  SYSTEM: 'Hệ thống',
};

export interface AppNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  /** Đường dẫn trong app để mở đối tượng liên quan, ví dụ "/quality/punch/pun-1". */
  readonly link: string | null;
  readonly projectCode: string | null;
  readonly createdAt: string;
  readonly read: boolean;
}

export interface NotificationPage extends PaginatedResponse<AppNotification> {
  readonly unreadCount: number;
}

/** Thông điệp server đẩy qua WebSocket. */
export type RealtimeMessage =
  | { readonly type: 'notification'; readonly data: AppNotification }
  | { readonly type: 'unread-count'; readonly data: number };

export function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return (message['type'] === 'notification' && typeof message['data'] === 'object') || (message['type'] === 'unread-count' && typeof message['data'] === 'number');
}
