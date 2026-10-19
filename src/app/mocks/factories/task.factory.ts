import { faker } from '@faker-js/faker/locale/vi';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { TaskPriority, TaskStatus } from '../../features/tasks/models/task.model';
import { parseIsoDate, toIsoDate } from '../../shared/utils/date.utils';
import { ProjectRecord, TaskCommentRecord, TaskRecord, WbsRecord } from '../models/mock-records';
import { elapsedFraction, inverseSCurve } from '../utils/project-metrics';
import { ProjectBlueprint } from './project.factory';

interface TaskTemplate {
  readonly key: string;
  readonly title: string;
  readonly labels: readonly string[];
  /** Thời lượng tương đối; mốc = 0. */
  readonly weight: number;
  /** key của công việc phải xong trước (FS). */
  readonly after: readonly string[];
  readonly milestone?: boolean;
}

interface WbsTemplate {
  readonly name: string;
  readonly tasks?: readonly (TaskTemplate | null)[];
  readonly children?: readonly WbsTemplate[];
}

function task(key: string, title: string, labels: string[], weight: number, after: string[] = []): TaskTemplate {
  return { key, title, labels, weight, after };
}

function milestone(key: string, title: string, after: string[]): TaskTemplate {
  return { key, title, labels: ['Nghiệm thu'], weight: 0, after, milestone: true };
}

function floorRange(from: number, to: number): string {
  return from === to ? `tầng ${from}` : `tầng ${from}–${to}`;
}

function buildingWbs(floors: number): WbsTemplate[] {
  const half = Math.ceil(floors / 2);
  const hasElevator = floors >= 5;
  return [
    {
      name: 'Công tác chuẩn bị',
      tasks: [
        task('survey', 'Khảo sát địa chất và định vị công trình', ['Thiết kế'], 2),
        task('permit', 'Xin giấy phép xây dựng, phê duyệt biện pháp thi công', ['Pháp lý'], 3, ['survey']),
      ],
    },
    {
      name: 'Phần ngầm',
      tasks: [
        task('piles', 'Thi công cọc khoan nhồi', ['Phần ngầm', 'Kết cấu'], 4, ['permit']),
        task('excavation', 'Đào đất hố móng và chống vách', ['Phần ngầm', 'An toàn'], 2, ['piles']),
        task('footing', 'Thi công đài móng, giằng móng', ['Phần ngầm', 'Kết cấu'], 2, ['excavation']),
        floors >= 10
          ? task('basement', 'Thi công tầng hầm và chống thấm', ['Phần ngầm'], 3, ['footing'])
          : task('basement', 'Thi công bể nước ngầm và hố ga', ['Phần ngầm', 'Cấp thoát nước'], 2, ['footing']),
        milestone('ms-foundation', 'Hoàn thành phần ngầm', ['basement']),
      ],
    },
    {
      name: 'Phần thân',
      children: [
        {
          name: 'Kết cấu',
          tasks: [
            task('frame-1', `Thi công kết cấu ${floorRange(1, half)}`, ['Kết cấu'], 5, ['ms-foundation']),
            task('frame-2', `Thi công kết cấu ${floorRange(half + 1, floors)}`, ['Kết cấu'], 5, ['frame-1']),
            milestone('ms-topping', 'Cất nóc công trình', ['frame-2']),
          ],
        },
        {
          name: 'Kiến trúc',
          tasks: [
            task('walls', 'Xây tường bao che và tường ngăn', ['Hoàn thiện'], 5, ['frame-1']),
            floors >= 10
              ? task('facade', 'Thi công mặt dựng kính', ['Hoàn thiện', 'Vật tư'], 4, ['ms-topping'])
              : task('facade', 'Trát, sơn hoàn thiện mặt ngoài', ['Hoàn thiện'], 3, ['ms-topping']),
          ],
        },
      ],
    },
    {
      name: 'Cơ điện (M&E)',
      tasks: [
        task('electric', 'Lắp đặt hệ thống điện', ['Điện', 'M&E'], 4, ['walls']),
        task('plumbing', 'Lắp đặt hệ thống cấp thoát nước', ['Cấp thoát nước', 'M&E'], 3, ['walls']),
        task('fire', 'Lắp đặt hệ thống PCCC', ['PCCC', 'M&E'], 2, ['walls']),
        hasElevator ? task('elevator', 'Lắp đặt thang máy', ['M&E'], 3, ['ms-topping']) : null,
      ],
    },
    {
      name: 'Hoàn thiện và bàn giao',
      tasks: [
        task('interior', 'Hoàn thiện nội thất và lát sàn', ['Hoàn thiện'], 4, ['electric', 'plumbing']),
        task('fire-check', 'Nghiệm thu PCCC và môi trường', ['Nghiệm thu', 'PCCC'], 1, ['fire', 'interior']),
        milestone('ms-handover', 'Nghiệm thu hoàn thành, bàn giao đưa vào sử dụng', [
          'fire-check',
          'facade',
          ...(hasElevator ? ['elevator'] : []),
        ]),
      ],
    },
  ];
}

const INFRASTRUCTURE_WBS: readonly WbsTemplate[] = [
  {
    name: 'Công tác chuẩn bị',
    tasks: [
      task('survey', 'Khảo sát địa hình, địa chất', ['Thiết kế'], 2),
      task('clearance', 'Giải phóng mặt bằng, di dời hạ tầng kỹ thuật', ['Pháp lý'], 4, ['survey']),
    ],
  },
  {
    name: 'Nền móng',
    tasks: [
      task('ground', 'San lấp và xử lý nền đất yếu', ['Phần ngầm'], 4, ['clearance']),
      task('piles', 'Thi công cọc khoan nhồi', ['Phần ngầm', 'Kết cấu'], 4, ['clearance']),
      task('foundation', 'Thi công móng và kết cấu chịu lực chính', ['Kết cấu'], 5, ['piles']),
      milestone('ms-foundation', 'Hoàn thành nền móng', ['foundation', 'ground']),
    ],
  },
  {
    name: 'Kết cấu và mặt',
    tasks: [
      task('steel', 'Gia công, lắp dựng kết cấu thép', ['Kết cấu', 'Vật tư'], 4, ['ms-foundation']),
      task('drainage', 'Thi công hệ thống thoát nước mặt', ['Cấp thoát nước'], 3, ['ground']),
      task('surface', 'Thi công lớp mặt bê tông', ['Kết cấu'], 3, ['steel', 'drainage']),
    ],
  },
  {
    name: 'Hệ thống kỹ thuật',
    tasks: [
      task('lighting', 'Lắp đặt hệ thống chiếu sáng', ['Điện'], 2, ['surface']),
      task('fire', 'Lắp đặt hệ thống PCCC và camera giám sát', ['PCCC', 'M&E'], 2, ['steel']),
      task('marking', 'Sơn kẻ vạch, lắp biển báo an toàn', ['An toàn', 'Hoàn thiện'], 1, ['surface']),
    ],
  },
  {
    name: 'Nghiệm thu',
    tasks: [
      task('load-test', 'Thử tải và kiểm định chất lượng', ['Nghiệm thu'], 1, ['lighting', 'marking']),
      task('restore', 'Hoàn trả mặt bằng, vệ sinh công trường', ['An toàn'], 1, ['load-test']),
      milestone('ms-handover', 'Nghiệm thu hoàn thành, bàn giao', ['restore', 'fire']),
    ],
  },
];

const DESCRIPTION_NOTES: readonly string[] = [
  'Đảm bảo an toàn lao động, vệ sinh môi trường trong suốt quá trình thi công.',
  'Phối hợp với tư vấn giám sát để nghiệm thu từng hạng mục.',
  'Kiểm tra chứng chỉ chất lượng vật tư trước khi đưa vào sử dụng.',
  'Lập nhật ký thi công và chụp ảnh hiện trường hằng ngày.',
  'Bố trí thi công ngoài giờ cao điểm để hạn chế ảnh hưởng giao thông khu vực.',
];

const COMMENT_SAMPLES: readonly string[] = [
  'Đã kiểm tra hiện trường, khối lượng đạt yêu cầu.',
  'Cần bổ sung biên bản nghiệm thu vật liệu đầu vào.',
  'Thời tiết mưa nhiều, đề xuất lùi hạn thêm 2 ngày.',
  'Đã điều thêm một tổ thợ để đẩy nhanh tiến độ.',
  'Đang chờ tư vấn giám sát xác nhận.',
  'Thép và xi măng đợt 2 đã về công trường.',
  'Phát hiện vết nứt nhỏ ở góc cột, đã yêu cầu xử lý.',
  'Bản vẽ shop drawing đã được phê duyệt, có thể triển khai.',
  'Nhắc đội thi công tuân thủ đeo dây an toàn khi làm việc trên cao.',
  'Đã hoàn thành 70%, dự kiến xong cuối tuần này.',
];

function pickPriority(): TaskPriority {
  return faker.helpers.weightedArrayElement<TaskPriority>([
    { value: 'LOW', weight: 15 },
    { value: 'MEDIUM', weight: 45 },
    { value: 'HIGH', weight: 30 },
    { value: 'URGENT', weight: 10 },
  ]);
}

function roundTo5(value: number): number {
  return Math.min(95, Math.max(5, Math.round(value / 5) * 5));
}

interface Scheduled {
  readonly template: TaskTemplate;
  readonly wbsId: string;
  readonly startFraction: number;
  readonly dueFraction: number;
}

/**
 * Lập lịch: forward pass theo phụ thuộc (có công việc song song), sau đó "uốn" trục thời gian
 * sao cho tỉ lệ công việc hoàn thành theo thời gian đi theo đường cong S của kế hoạch.
 */
export function scheduleTemplates(items: readonly { template: TaskTemplate; wbsId: string }[]): Scheduled[] {
  const finish = new Map<string, number>();
  const linear = items.map(({ template, wbsId }) => {
    const start = Math.max(0, ...template.after.map((key) => finish.get(key) ?? 0));
    const end = start + template.weight;
    finish.set(template.key, end);
    return { template, wbsId, start, end };
  });
  const total = Math.max(1, ...linear.map((item) => item.end));

  // Hàm phân phối luỹ kế của thời điểm hoàn thành (theo thời gian tuyến tính).
  const ends = linear.map((item) => item.end / total).sort((a, b) => a - b);
  const points: [number, number][] = [[0, 0]];
  ends.forEach((value, index) => {
    const last = points[points.length - 1];
    if (last[0] === value) {
      last[1] = (index + 1) / ends.length;
    } else {
      points.push([value, (index + 1) / ends.length]);
    }
  });
  const cdf = (u: number): number => {
    for (let index = 1; index < points.length; index++) {
      const [x1, y1] = points[index];
      const [x0, y0] = points[index - 1];
      if (u <= x1) {
        return x1 === x0 ? y1 : y0 + ((u - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return 1;
  };
  const warp = (u: number): number => inverseSCurve(cdf(u));

  return linear.map((item) => ({
    template: item.template,
    wbsId: item.wbsId,
    startFraction: warp(item.start / total),
    dueFraction: warp(item.end / total),
  }));
}

/** Sinh cây WBS và công việc của dự án; trạng thái suy ra từ hiệu suất thi công (performance). */
export function createProjectTasks(
  project: ProjectRecord,
  blueprint: ProjectBlueprint,
  assigneePool: readonly string[],
  today: Date,
): { tasks: TaskRecord[]; wbs: WbsRecord[] } {
  const templates = blueprint.floors > 0 ? buildingWbs(blueprint.floors) : INFRASTRUCTURE_WBS;
  const prefix = project.code.toLowerCase();
  const wbs: WbsRecord[] = [];
  const items: { template: TaskTemplate; wbsId: string }[] = [];

  const walk = (nodes: readonly WbsTemplate[], parentId: string | null, path: string): void => {
    nodes.forEach((node, index) => {
      const id = `wbs-${prefix}-${path}${index + 1}`;
      wbs.push({ id, projectId: project.id, parentId, name: node.name, order: index + 1 });
      (node.tasks ?? []).forEach((template) => template && items.push({ template, wbsId: id }));
      walk(node.children ?? [], id, `${path}${index + 1}-`);
    });
  };
  walk(templates, null, '');

  const start = parseIsoDate(project.startDate);
  const totalDays = differenceInCalendarDays(parseIsoDate(project.endDate), start);
  const effective = Math.min(1, elapsedFraction(project, today) * blueprint.performance);
  const idOf = (key: string): string => `tsk-${prefix}-${key}`;

  const tasks = scheduleTemplates(items).map(({ template, wbsId, startFraction, dueFraction }) => {
    let status: TaskStatus = 'TODO';
    let percentComplete = 0;
    if (project.status === 'COMPLETED' || dueFraction <= effective) {
      status = 'DONE';
      percentComplete = 100;
    } else if (project.status !== 'PLANNING' && startFraction <= effective && !template.milestone) {
      percentComplete = roundTo5(((effective - startFraction) / (dueFraction - startFraction)) * 100);
      status = percentComplete >= 80 ? 'REVIEW' : 'IN_PROGRESS';
    }

    const startDate = addDays(start, Math.round(startFraction * totalDays));
    const dueDate = template.milestone ? startDate : addDays(start, Math.round(dueFraction * totalDays));
    const createdAt = addDays(startDate, -14).toISOString();
    const record: TaskRecord = {
      id: idOf(template.key),
      projectId: project.id,
      title: template.title,
      description: template.milestone
        ? `Mốc tiến độ: ${template.title.toLowerCase()}.`
        : `${template.title} theo hồ sơ thiết kế được phê duyệt. ${faker.helpers.arrayElement(DESCRIPTION_NOTES)}`,
      status,
      priority: template.milestone ? 'HIGH' : pickPriority(),
      assigneeId: faker.datatype.boolean({ probability: 0.95 }) ? faker.helpers.arrayElement(assigneePool) : null,
      startDate: toIsoDate(startDate),
      dueDate: toIsoDate(dueDate),
      percentComplete,
      labels: template.labels,
      order: 0,
      wbsId,
      dependencyIds: template.after.map(idOf),
      isMilestone: template.milestone === true,
      createdAt,
      updatedAt: createdAt,
    };
    return record;
  });
  return { tasks, wbs };
}

/** Gán thứ tự Kanban: trong mỗi cột, sắp theo hạn hoàn thành. */
export function assignKanbanOrder(tasks: readonly TaskRecord[]): TaskRecord[] {
  const counters = new Map<TaskStatus, number>();
  return [...tasks]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((task) => {
      const position = (counters.get(task.status) ?? 0) + 1;
      counters.set(task.status, position);
      return { ...task, order: position * 1000 };
    });
}

export function createTaskComments(task: TaskRecord, authorPool: readonly string[], today: Date): TaskCommentRecord[] {
  if (task.status === 'TODO' || authorPool.length === 0) {
    return [];
  }
  const from = new Date(task.createdAt);
  const to = today.getTime() > from.getTime() ? today : addDays(from, 1);
  return Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, (_, index) => ({
    id: `cmt-${task.id}-${index + 1}`,
    taskId: task.id,
    authorId: faker.helpers.arrayElement(authorPool),
    content: faker.helpers.arrayElement(COMMENT_SAMPLES),
    createdAt: faker.date.between({ from, to }).toISOString(),
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
