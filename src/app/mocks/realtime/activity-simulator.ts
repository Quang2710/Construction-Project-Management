import { addDays } from 'date-fns';
import { toIsoDate, todayIso } from '../../shared/utils/date.utils';
import { db } from '../db';
import { canViewProject } from '../utils/serializers';
import { NotificationInput, notificationHub } from './notification-hub';

const WEATHER_ALERTS = [
  'Dự báo mưa giông chiều nay, kiểm tra che chắn vật tư và an toàn giàn giáo.',
  'Nắng nóng trên 37 °C, bố trí giờ nghỉ và nước uống cho công nhân.',
  'Gió giật cấp 6, tạm dừng cẩu lắp cấu kiện trên cao.',
  'Mưa lớn kéo dài, theo dõi thoát nước hố móng.',
];

/** Tỉ lệ người dùng đang online nhận một sự kiện mỗi chu kỳ (tránh dồn dập). */
const EVENT_PROBABILITY = 0.6;

function pick<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/** Sinh một sự kiện "đang diễn ra" từ dữ liệu thật của người dùng (việc sắp đến hạn, vật tư thiếu, thời tiết). */
export function nextActivity(userId: string): NotificationInput | null {
  const user = db.users.findById(userId);
  if (!user) {
    return null;
  }
  const projects = db.projects.filter((project) => project.status === 'IN_PROGRESS' && canViewProject(user, project));
  const projectIds = new Set(projects.map((project) => project.id));
  const candidates: NotificationInput[] = [];

  const soon = toIsoDate(addDays(new Date(), 2));
  const dueTask = pick(
    db.tasks.filter((task) => task.assigneeId === userId && task.status !== 'DONE' && task.dueDate >= todayIso() && task.dueDate <= soon),
  );
  if (dueTask) {
    candidates.push({
      type: 'SCHEDULE',
      title: 'Công việc sắp đến hạn',
      message: `"${dueTask.title}" đến hạn ngày ${dueTask.dueDate.split('-').reverse().join('/')}.`,
      link: '/tasks',
      projectId: dueTask.projectId,
    });
  }

  if (user.role !== 'CLIENT') {
    const low = pick(db.stock.filter((item) => projectIds.has(item.projectId) && item.quantity < item.minQuantity));
    const material = low ? db.materials.findById(low.materialId) : undefined;
    if (low && material) {
      candidates.push({
        type: 'MATERIAL',
        title: 'Vật tư dưới mức tồn tối thiểu',
        message: `${material.name}: còn ${low.quantity} ${material.unit} (tối thiểu ${low.minQuantity}).`,
        link: `/materials?projectId=${low.projectId}`,
        projectId: low.projectId,
      });
    }
  }

  const site = pick(projects);
  const alert = pick(WEATHER_ALERTS);
  if (site && alert) {
    candidates.push({ type: 'WEATHER', title: `Cảnh báo thời tiết · ${site.code}`, message: alert, link: null, projectId: site.id });
  }
  return pick(candidates) ?? null;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Mỗi chu kỳ, một số người đang online nhận một sự kiện giả lập. */
export function startActivitySimulation(intervalMs: number): void {
  if (timer || intervalMs <= 0) {
    return;
  }
  timer = setInterval(() => {
    const online = notificationHub.connectedUserIds();
    if (online.length === 0) {
      stopActivitySimulation();
      return;
    }
    for (const userId of online) {
      const activity = Math.random() < EVENT_PROBABILITY ? nextActivity(userId) : null;
      if (activity) {
        notificationHub.notify([userId], activity);
      }
    }
  }, intervalMs);
}

export function stopActivitySimulation(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
