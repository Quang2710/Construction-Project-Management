import { faker } from '@faker-js/faker/locale/vi';
import { addHours, differenceInCalendarDays, isSunday, subDays } from 'date-fns';
import {
  DiaryPhoto,
  DiaryStatus,
  DiaryWeather,
  EquipmentEntry,
  IncidentEntry,
  LaborEntry,
  WeatherCondition,
  WorkItemEntry,
} from '../../features/site-diaries/models/site-diary.model';
import { parseIsoDate, toIsoDate } from '../../shared/utils/date.utils';
import { DiaryHistoryRecord, ProjectRecord, SiteDiaryRecord } from '../models/mock-records';
import { apiUrl } from '../utils/http.utils';

const DIARY_DAYS = 30;

interface WorkTemplate {
  readonly description: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
}

const BUILDING_WORK: readonly WorkTemplate[] = [
  { description: 'Đổ bê tông sàn tầng {f}', unit: 'm³', min: 40, max: 120 },
  { description: 'Lắp dựng cốt thép cột, vách tầng {f}', unit: 'tấn', min: 3, max: 12 },
  { description: 'Lắp dựng cốp pha dầm sàn tầng {f}', unit: 'm²', min: 200, max: 600 },
  { description: 'Xây tường gạch tầng {f}', unit: 'm³', min: 10, max: 40 },
  { description: 'Trát tường trong tầng {f}', unit: 'm²', min: 150, max: 500 },
  { description: 'Lắp đặt ống cấp thoát nước tầng {f}', unit: 'm', min: 60, max: 200 },
  { description: 'Kéo cáp điện trục đứng', unit: 'm', min: 100, max: 300 },
];

const INFRASTRUCTURE_WORK: readonly WorkTemplate[] = [
  { description: 'Đào đất nền', unit: 'm³', min: 300, max: 1200 },
  { description: 'Đắp cát nền K95', unit: 'm³', min: 200, max: 800 },
  { description: 'Thi công cọc khoan nhồi D1200', unit: 'cọc', min: 1, max: 3 },
  { description: 'Lắp dựng dầm thép', unit: 'tấn', min: 8, max: 30 },
  { description: 'Đổ bê tông bản mặt', unit: 'm³', min: 50, max: 150 },
  { description: 'Lắp đặt cống thoát nước D800', unit: 'm', min: 20, max: 80 },
];

const CREWS = ['Tổ cốp pha', 'Tổ cốt thép', 'Tổ bê tông', 'Tổ nề', 'Tổ điện', 'Tổ cấp thoát nước', 'Tổ hoàn thiện', 'Tổ cơ giới'];
const EQUIPMENT = ['Cần trục tháp', 'Vận thăng', 'Máy đào', 'Xe bơm bê tông', 'Máy đầm dùi', 'Máy phát điện', 'Máy hàn'];

const INCIDENTS: readonly IncidentEntry[] = [
  {
    type: 'SAFETY',
    severity: 'LOW',
    description: 'Công nhân bị trầy xước tay khi tháo cốp pha.',
    actionTaken: 'Sơ cứu tại chỗ, nhắc nhở đeo găng tay bảo hộ.',
  },
  {
    type: 'SAFETY',
    severity: 'MEDIUM',
    description: 'Lan can tạm khu vực giếng thang bị lỏng.',
    actionTaken: 'Dừng thi công khu vực 30 phút, gia cố lại lan can.',
  },
  {
    type: 'ENVIRONMENT',
    severity: 'MEDIUM',
    description: 'Mưa lớn gây ngập cục bộ hố móng.',
    actionTaken: 'Bố trí 2 máy bơm thoát nước trong 3 giờ.',
  },
  {
    type: 'EQUIPMENT',
    severity: 'LOW',
    description: 'Xe bơm bê tông bị nứt ống, gián đoạn đổ bê tông 1 giờ.',
    actionTaken: 'Thay ống dự phòng, tiếp tục đổ bê tông.',
  },
  {
    type: 'QUALITY',
    severity: 'MEDIUM',
    description: 'Phát hiện rỗ bề mặt bê tông cột trục C.',
    actionTaken: 'Lập biên bản, sửa chữa theo chỉ dẫn của tư vấn giám sát.',
  },
];

const NOTES = [
  'Họp giao ban với tư vấn giám sát lúc 7h30.',
  'Thép D16 về công trường 25 tấn, đã nghiệm thu vật liệu đầu vào.',
  'Kiểm tra an toàn giàn giáo đầu ca: đạt yêu cầu.',
  'Chủ đầu tư đến kiểm tra hiện trường buổi chiều.',
  'Vệ sinh công trường cuối ngày, thu gom phế thải.',
  '',
];

const PHOTO_CAPTIONS = [
  'Toàn cảnh công trường',
  'Đổ bê tông',
  'Lắp dựng cốt thép',
  'Kiểm tra an toàn giàn giáo',
  'Tập kết vật tư',
  'Nghiệm thu cốp pha',
  'Thi công hệ thống M&E',
];

const REJECT_NOTES = [
  'Thiếu khối lượng bê tông đã đổ, đề nghị bổ sung.',
  'Số nhân công không khớp bảng chấm công, kiểm tra lại.',
  'Bổ sung ảnh nghiệm thu cốt thép trước khi đổ bê tông.',
];

function pickWeather(): WeatherCondition {
  return faker.helpers.weightedArrayElement<WeatherCondition>([
    { value: 'SUNNY', weight: 40 },
    { value: 'CLOUDY', weight: 30 },
    { value: 'LIGHT_RAIN', weight: 15 },
    { value: 'HEAVY_RAIN', weight: 10 },
    { value: 'STORM', weight: 5 },
  ]);
}

function createWeather(project: ProjectRecord): DiaryWeather {
  // Miền Bắc mát hơn miền Nam.
  const base = project.location.lat > 19 ? 22 : project.location.lat > 14 ? 24 : 26;
  const minTemp = base + faker.number.int({ min: 0, max: 3 });
  return { morning: pickWeather(), afternoon: pickWeather(), minTemp, maxTemp: minTemp + faker.number.int({ min: 5, max: 9 }) };
}

function createLabor(weather: DiaryWeather): LaborEntry[] {
  const badWeather = ['HEAVY_RAIN', 'STORM'].includes(weather.morning) && ['HEAVY_RAIN', 'STORM'].includes(weather.afternoon);
  return faker.helpers.arrayElements(CREWS, { min: 3, max: 6 }).map((crew) => ({
    crew,
    headcount: faker.number.int({ min: badWeather ? 1 : 4, max: badWeather ? 6 : 24 }),
  }));
}

function createEquipment(): EquipmentEntry[] {
  return faker.helpers.arrayElements(EQUIPMENT, { min: 2, max: 4 }).map((name) => ({
    name,
    quantity: faker.number.int({ min: 1, max: 3 }),
    hours: faker.number.int({ min: 4, max: 10 }),
  }));
}

function createWorkItems(floors: number): WorkItemEntry[] {
  const templates = floors > 0 ? BUILDING_WORK : INFRASTRUCTURE_WORK;
  const floor = String(faker.number.int({ min: 1, max: Math.max(1, floors) }));
  return faker.helpers.arrayElements(templates, { min: 2, max: 4 }).map((template) => ({
    description: template.description.replace('{f}', floor),
    unit: template.unit,
    quantity: faker.number.int({ min: template.min, max: template.max }),
  }));
}

function createPhotos(diaryId: string, project: ProjectRecord, date: Date): DiaryPhoto[] {
  return Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, (_, index) => {
    const id = `seed-${diaryId}-${index + 1}`;
    return {
      id,
      url: apiUrl(`/files/${id}`),
      fileName: `IMG_${toIsoDate(date).replace(/-/g, '')}_${String(index + 1).padStart(3, '0')}.jpg`,
      mimeType: 'image/svg+xml',
      size: faker.number.int({ min: 180_000, max: 450_000 }),
      caption: faker.helpers.arrayElement(PHOTO_CAPTIONS),
      takenAt: addHours(date, faker.number.int({ min: 7, max: 17 })).toISOString(),
      // Ảnh chụp trong phạm vi ~60 m quanh công trình.
      location: {
        lat: project.location.lat + faker.number.float({ min: -0.0006, max: 0.0006 }),
        lng: project.location.lng + faker.number.float({ min: -0.0006, max: 0.0006 }),
        accuracy: faker.number.int({ min: 5, max: 25 }),
      },
    };
  });
}

function pickStatus(daysAgo: number): DiaryStatus | null {
  if (daysAgo >= 7) {
    return 'APPROVED';
  }
  if (daysAgo >= 3) {
    return faker.helpers.weightedArrayElement<DiaryStatus>([
      { value: 'APPROVED', weight: 50 },
      { value: 'SUBMITTED', weight: 35 },
      { value: 'REJECTED', weight: 15 },
    ]);
  }
  if (daysAgo >= 1) {
    return faker.helpers.weightedArrayElement<DiaryStatus>([
      { value: 'SUBMITTED', weight: 70 },
      { value: 'DRAFT', weight: 30 },
    ]);
  }
  // Hôm nay: một số nơi đã lập bản nháp.
  return faker.datatype.boolean({ probability: 0.6 }) ? 'DRAFT' : null;
}

function createHistory(
  status: DiaryStatus,
  date: Date,
  authorId: string,
  reviewerId: string,
  reviewNote: string,
): DiaryHistoryRecord[] {
  const history: DiaryHistoryRecord[] = [{ action: 'CREATED', byId: authorId, at: addHours(date, 17).toISOString(), note: '' }];
  if (status !== 'DRAFT') {
    history.push({ action: 'SUBMITTED', byId: authorId, at: addHours(date, 18).toISOString(), note: '' });
  }
  if (status === 'APPROVED' || status === 'REJECTED') {
    history.push({ action: status, byId: reviewerId, at: addHours(date, 33).toISOString(), note: reviewNote });
  }
  return history;
}

/** Nhật ký 30 ngày gần nhất (trừ Chủ nhật, thỉnh thoảng thiếu ngày) cho dự án đang thi công/tạm dừng. */
export function createProjectDiaries(project: ProjectRecord, floors: number, today: Date): SiteDiaryRecord[] {
  if (project.status !== 'IN_PROGRESS' && project.status !== 'ON_HOLD') {
    return [];
  }
  const authors = project.memberIds.length ? [...project.memberIds] : [project.managerId ?? 'usr-admin'];
  const reviewerId = project.managerId ?? 'usr-pm';
  // Dự án tạm dừng: nhật ký dừng lại từ 3 tuần trước.
  const lastDayOffset = project.status === 'ON_HOLD' ? 21 : 0;
  const projectStart = parseIsoDate(project.startDate);
  const diaries: SiteDiaryRecord[] = [];

  for (let offset = DIARY_DAYS; offset >= lastDayOffset; offset--) {
    const day = subDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), offset);
    if (isSunday(day) || day < projectStart || faker.datatype.boolean({ probability: 0.05 })) {
      continue;
    }
    const daysAgo = differenceInCalendarDays(today, day);
    const status = pickStatus(daysAgo);
    if (!status) {
      continue;
    }
    const id = `dry-${project.code.toLowerCase()}-${toIsoDate(day).replace(/-/g, '')}`;
    const authorId = authors.includes('usr-engineer') && faker.datatype.boolean() ? 'usr-engineer' : faker.helpers.arrayElement(authors);
    const reviewNote = status === 'REJECTED' ? faker.helpers.arrayElement(REJECT_NOTES) : status === 'APPROVED' ? 'Đồng ý.' : '';
    const weather = createWeather(project);
    const history = createHistory(status, day, authorId, reviewerId, reviewNote);

    diaries.push({
      id,
      projectId: project.id,
      date: toIsoDate(day),
      weather,
      labor: createLabor(weather),
      equipment: createEquipment(),
      workItems: createWorkItems(floors),
      incidents: faker.datatype.boolean({ probability: 0.12 }) ? [faker.helpers.arrayElement(INCIDENTS)] : [],
      notes: faker.helpers.arrayElement(NOTES),
      photos: createPhotos(id, project, day),
      status,
      createdById: authorId,
      reviewNote,
      history,
      createdAt: history[0].at,
      updatedAt: history[history.length - 1].at,
    });
  }
  return diaries;
}
