import { AppNotification, NotificationType, RealtimeMessage } from '../../shared/models/notification.model';
import { UserRole } from '../../shared/models/user.model';
import { db } from '../db';
import { NotificationRecord } from '../models/mock-records';
import { newId } from '../utils/serializers';

export type RealtimeSender = (message: RealtimeMessage) => void;

export interface NotificationInput {
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly link: string | null;
  readonly projectId?: string | null;
}

/** Người dùng đang kết nối WebSocket (một người có thể mở nhiều tab). */
const connections = new Map<string, Set<RealtimeSender>>();

export function toNotificationDto(record: NotificationRecord): AppNotification {
  const { userId: _userId, readAt, ...rest } = record;
  return { ...rest, read: readAt !== null };
}

export function unreadCount(userId: string): number {
  return db.notifications.filter((item) => item.userId === userId && item.readAt === null).length;
}

function send(userId: string, message: RealtimeMessage): void {
  connections.get(userId)?.forEach((sender) => sender(message));
}

/** "Server" thông báo của fake BE: lưu DB rồi đẩy tới các kết nối đang mở. */
export const notificationHub = {
  connect(userId: string, sender: RealtimeSender): () => void {
    const senders = connections.get(userId) ?? new Set<RealtimeSender>();
    senders.add(sender);
    connections.set(userId, senders);
    sender({ type: 'unread-count', data: unreadCount(userId) });
    return () => {
      senders.delete(sender);
      if (senders.size === 0) {
        connections.delete(userId);
      }
    };
  },

  connectedUserIds(): string[] {
    return [...connections.keys()];
  },

  /** Gửi tới từng người nhận (bỏ trùng, bỏ người thực hiện thao tác). */
  notify(userIds: readonly (string | null | undefined)[], input: NotificationInput, exceptUserId?: string): AppNotification[] {
    const project = input.projectId ? db.projects.findById(input.projectId) : undefined;
    const recipients = [...new Set(userIds.filter((id): id is string => !!id && id !== exceptUserId))];
    return recipients.map((userId) => {
      const record = db.notifications.insert({
        id: newId('ntf'),
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        projectCode: project?.code ?? null,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      const dto = toNotificationDto(record);
      send(userId, { type: 'notification', data: dto });
      return dto;
    });
  },

  /** Cập nhật badge ở mọi tab của người dùng (sau khi đánh dấu đã đọc). */
  syncUnread(userId: string): void {
    send(userId, { type: 'unread-count', data: unreadCount(userId) });
  },

  /** Chỉ dùng trong unit test. */
  reset(): void {
    connections.clear();
  },
};

/** Quản lý dự án (người duyệt cấp công trường). */
export function projectManagerId(projectId: string): string | null {
  return db.projects.findById(projectId)?.managerId ?? null;
}

/** Quản lý + thành viên dự án. */
export function projectTeamIds(projectId: string): string[] {
  const project = db.projects.findById(projectId);
  return project ? [project.managerId, ...project.memberIds].filter((id): id is string => id !== null) : [];
}

export function userIdsWithRole(role: UserRole): string[] {
  return db.users.filter((user) => user.role === role && user.active).map((user) => user.id);
}
