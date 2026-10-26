import { subHours } from 'date-fns';
import { InspectionRecord, NotificationRecord, ProjectRecord, PunchRecord } from '../models/mock-records';

type SeedItem = Omit<NotificationRecord, 'id' | 'userId' | 'createdAt' | 'readAt'>;

/** Vài thông báo có sẵn cho tài khoản demo để chuông không trống lúc mới mở app. */
export function createNotificationSeed(
  projects: readonly ProjectRecord[],
  inspections: readonly InspectionRecord[],
  punchItems: readonly PunchRecord[],
  today: Date,
): NotificationRecord[] {
  const records: NotificationRecord[] = [];
  const code = (projectId: string): string | null => projects.find((project) => project.id === projectId)?.code ?? null;
  const add = (userId: string, hoursAgo: number, read: boolean, item: SeedItem): void => {
    const createdAt = subHours(today, hoursAgo).toISOString();
    records.push({ ...item, id: `ntf-seed-${records.length + 1}`, userId, createdAt, readAt: read ? createdAt : null });
  };

  const managedByDemoPm = (projectId: string): boolean => projects.find((project) => project.id === projectId)?.managerId === 'usr-pm';
  const awaitingL1 = inspections.find((item) => item.status === 'IN_REVIEW' && item.currentLevel === 1 && managedByDemoPm(item.projectId));
  if (awaitingL1) {
    add('usr-pm', 2, false, {
      type: 'QUALITY',
      title: `Phiếu ${awaitingL1.code} chờ bạn duyệt cấp 1`,
      message: awaitingL1.title,
      link: `/quality/inspections/${awaitingL1.id}`,
      projectCode: code(awaitingL1.projectId),
    });
  }
  const awaitingL2 = inspections.find((item) => item.status === 'IN_REVIEW' && item.currentLevel === 2);
  if (awaitingL2) {
    add('usr-admin', 5, false, {
      type: 'QUALITY',
      title: `Phiếu ${awaitingL2.code} chờ QA/QC duyệt`,
      message: awaitingL2.title,
      link: `/quality/inspections/${awaitingL2.id}`,
      projectCode: code(awaitingL2.projectId),
    });
  }
  punchItems
    .filter((item) => item.assigneeId === 'usr-engineer' && item.status !== 'VERIFIED')
    .slice(0, 3)
    .forEach((item, index) =>
      add('usr-engineer', 3 + index * 7, index > 0, {
        type: 'PUNCH',
        title: `Bạn được giao xử lý ${item.code}`,
        message: item.title,
        link: `/quality/punch/${item.id}`,
        projectCode: code(item.projectId),
      }),
    );

  for (const userId of ['usr-admin', 'usr-pm', 'usr-engineer', 'usr-client']) {
    add(userId, 26, true, {
      type: 'SYSTEM',
      title: 'Chào mừng đến hệ thống quản lý dự án',
      message: 'Thông báo mới sẽ hiện ở biểu tượng chuông theo thời gian thực.',
      link: null,
      projectCode: null,
    });
  }
  add('usr-client', 4, false, {
    type: 'WEATHER',
    title: 'Cảnh báo mưa lớn',
    message: 'Dự báo mưa to chiều nay, các công trường tạm dừng đổ bê tông ngoài trời.',
    link: null,
    projectCode: null,
  });
  return records;
}
