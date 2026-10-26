import { faker } from '@faker-js/faker/locale/vi';
import { addDays, addHours, subDays } from 'date-fns';
import {
  ChecklistItem,
  ChecklistTemplate,
  INSPECTION_APPROVAL_LEVELS,
  InspectionStatus,
  PunchSeverity,
  PunchStatus,
} from '../../features/quality/models/quality.model';
import { Photo } from '../../shared/models/photo.model';
import { toIsoDate } from '../../shared/utils/date.utils';
import {
  InspectionApprovalRecord,
  InspectionHistoryRecord,
  InspectionRecord,
  ProjectRecord,
  PunchHistoryRecord,
  PunchRecord,
  WbsRecord,
} from '../models/mock-records';
import { apiUrl } from '../utils/http.utils';

/** Người duyệt cấp QA/QC (cấp 2). */
const QA_REVIEWER_ID = 'usr-admin';

export const CHECKLIST_TEMPLATES: readonly ChecklistTemplate[] = [
  {
    id: 'tpl-rebar',
    name: 'Nghiệm thu cốt thép',
    items: [
      { criterion: 'Chủng loại, đường kính thép', requirement: 'Đúng thiết kế, có chứng chỉ xuất xưởng (TCVN 1651:2018)' },
      { criterion: 'Số lượng, khoảng cách thanh', requirement: 'Sai lệch khoảng cách ≤ ±10 mm (TCVN 4453:1995)' },
      { criterion: 'Chiều dài neo, nối chồng', requirement: '≥ 30d hoặc theo bản vẽ thiết kế' },
      { criterion: 'Lớp bê tông bảo vệ (con kê)', requirement: 'Đúng chiều dày thiết kế, sai số ±5 mm' },
      { criterion: 'Vệ sinh cốt thép', requirement: 'Không gỉ vảy, dầu mỡ, bùn đất' },
      { criterion: 'Liên kết buộc, hàn', requirement: 'Chắc chắn, không xê dịch khi đổ bê tông' },
    ],
  },
  {
    id: 'tpl-formwork',
    name: 'Nghiệm thu cốp pha, đà giáo',
    items: [
      { criterion: 'Kích thước hình học, tim trục', requirement: 'Sai lệch ≤ ±5 mm' },
      { criterion: 'Cao độ đáy, mặt cốp pha', requirement: 'Sai lệch ≤ ±5 mm so với thiết kế' },
      { criterion: 'Độ kín khít', requirement: 'Không mất nước xi măng khi đổ bê tông' },
      { criterion: 'Hệ chống đỡ, đà giáo', requirement: 'Đúng biện pháp thi công đã duyệt, ổn định' },
      { criterion: 'Chất chống dính', requirement: 'Quét đều toàn bộ bề mặt tiếp xúc' },
    ],
  },
  {
    id: 'tpl-concrete',
    name: 'Nghiệm thu đổ bê tông',
    items: [
      { criterion: 'Cấp độ bền, phiếu giao hàng', requirement: 'Đúng cấp phối thiết kế đã phê duyệt' },
      { criterion: 'Độ sụt hỗn hợp', requirement: 'Theo cấp phối, sai số ±2 cm' },
      { criterion: 'Lấy mẫu thí nghiệm', requirement: '≥ 1 tổ mẫu / 20 m³ (TCVN 4453:1995)' },
      { criterion: 'Đầm, bảo dưỡng', requirement: 'Đầm kỹ; bảo dưỡng ẩm tối thiểu 7 ngày' },
      { criterion: 'Bề mặt sau tháo khuôn', requirement: 'Không rỗ, nứt, lộ cốt thép' },
    ],
  },
  {
    id: 'tpl-masonry',
    name: 'Nghiệm thu xây, trát',
    items: [
      { criterion: 'Vật liệu gạch, vữa', requirement: 'Đúng chủng loại, mác vữa thiết kế' },
      { criterion: 'Độ thẳng đứng, mặt phẳng tường', requirement: 'Sai lệch ≤ 5 mm / 2 m (TCVN 4085:2011)' },
      { criterion: 'Mạch vữa', requirement: 'Dày 8–12 mm, đầy vữa, so le' },
      { criterion: 'Liên kết tường – cột', requirement: 'Râu thép theo thiết kế' },
      { criterion: 'Độ phẳng lớp trát', requirement: 'Sai lệch ≤ 3 mm / 2 m, không nứt bong' },
    ],
  },
  {
    id: 'tpl-mep',
    name: 'Nghiệm thu lắp đặt điện, nước',
    items: [
      { criterion: 'Chủng loại vật tư, thiết bị', requirement: 'Đúng hồ sơ vật liệu đã phê duyệt' },
      { criterion: 'Tuyến ống, máng cáp', requirement: 'Đúng bản vẽ shop drawing' },
      { criterion: 'Thử áp lực đường ống', requirement: '1,5 lần áp suất làm việc, giữ 30 phút không tụt áp' },
      { criterion: 'Điện trở cách điện', requirement: '≥ 1 MΩ' },
      { criterion: 'Nối đất, chống sét', requirement: 'Điện trở nối đất ≤ 4 Ω' },
    ],
  },
  {
    id: 'tpl-finishing',
    name: 'Nghiệm thu hoàn thiện',
    items: [
      { criterion: 'Ốp lát gạch', requirement: 'Phẳng ≤ 2 mm / 2 m, mạch đều, không bộp' },
      { criterion: 'Sơn bả', requirement: 'Đúng màu mẫu, không loang, không bong tróc' },
      { criterion: 'Cửa, khoá, phụ kiện', requirement: 'Đóng mở nhẹ, kín khít' },
      { criterion: 'Thiết bị vệ sinh', requirement: 'Lắp chắc chắn, không rò rỉ' },
      { criterion: 'Vệ sinh mặt bằng', requirement: 'Sạch sẽ trước khi bàn giao' },
    ],
  },
];

const LOCATIONS = ['Tầng {f}, trục A–C', 'Tầng {f}, trục 3–6', 'Sàn tầng {f}', 'Cột tầng {f}', 'Lõi thang tầng {f}', 'Khu WC tầng {f}'];
const INFRA_LOCATIONS = ['Km 0+250 – 0+400', 'Mố M1', 'Trụ T2', 'Đoạn tuyến số 3', 'Nút giao phía Bắc'];

const PUNCH_TEMPLATES: readonly { title: string; description: string; severity: PunchSeverity }[] = [
  { title: 'Rỗ bề mặt bê tông dầm', description: 'Bề mặt dầm sau tháo cốp pha bị rỗ tổ ong khoảng 0,3 m².', severity: 'MEDIUM' },
  { title: 'Thiếu con kê lớp bảo vệ sàn', description: 'Một số vị trí thép sàn sát cốp pha, chưa đủ con kê.', severity: 'HIGH' },
  { title: 'Mạch vữa tường không đầy', description: 'Mạch đứng tường xây chưa đầy vữa, cần chèn lại.', severity: 'LOW' },
  { title: 'Rò rỉ ống cấp nước khu WC', description: 'Thử áp phát hiện rò tại mối nối ren.', severity: 'HIGH' },
  { title: 'Sơn tường loang màu', description: 'Tường hành lang loang màu, cần sơn lại lớp hoàn thiện.', severity: 'LOW' },
  { title: 'Gạch ốp bị bộp', description: 'Gõ kiểm tra phát hiện 6 viên gạch ốp bị bộp.', severity: 'MEDIUM' },
  { title: 'Cốp pha cột hở khe', description: 'Khe hở chân cột ~5 mm, nguy cơ mất nước xi măng.', severity: 'MEDIUM' },
  { title: 'Lan can cầu thang chưa chắc chắn', description: 'Liên kết chân lan can lỏng, mất an toàn khi sử dụng.', severity: 'HIGH' },
  { title: 'Nứt chân chim lớp trát', description: 'Xuất hiện vết nứt chân chim tại tường ngoài.', severity: 'LOW' },
  { title: 'Dây điện chưa đi trong ống', description: 'Một số đoạn dây đi nổi, chưa luồn ống bảo vệ.', severity: 'MEDIUM' },
];

const RESOLVE_NOTES = ['Đã khắc phục theo yêu cầu.', 'Đã đục bỏ và xử lý lại.', 'Đã thay thế vật tư lỗi.', 'Đã chèn vữa, vệ sinh bề mặt.'];

/** Trạng thái các phiếu gần đây theo thứ tự: đảm bảo mỗi dự án đang thi công có đủ các bước duyệt. */
type SeedInspectionState = InspectionStatus | 'IN_REVIEW_L2';
const RECENT_STATES: readonly SeedInspectionState[] = ['APPROVED', 'IN_REVIEW_L2', 'REJECTED', 'IN_REVIEW', 'DRAFT'];

export interface QualitySeed {
  readonly inspections: InspectionRecord[];
  readonly punchItems: PunchRecord[];
}

function seedPhotos(prefix: string, project: ProjectRecord, at: Date, count: number, caption: string): Photo[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `seed-${prefix}-${index + 1}`;
    return {
      id,
      url: apiUrl(`/files/${id}`),
      fileName: `IMG_${toIsoDate(at).replace(/-/g, '')}_${String(index + 1).padStart(3, '0')}.jpg`,
      mimeType: 'image/svg+xml',
      size: faker.number.int({ min: 180_000, max: 420_000 }),
      caption,
      takenAt: at.toISOString(),
      location: {
        lat: project.location.lat + faker.number.float({ min: -0.0005, max: 0.0005 }),
        lng: project.location.lng + faker.number.float({ min: -0.0005, max: 0.0005 }),
        accuracy: faker.number.int({ min: 5, max: 20 }),
      },
    };
  });
}

/** Hạng mục lá (không có con) để gắn phiếu nghiệm thu. */
function leafWbs(wbs: readonly WbsRecord[], projectId: string): WbsRecord[] {
  const nodes = wbs.filter((node) => node.projectId === projectId);
  return nodes.filter((node) => !nodes.some((child) => child.parentId === node.id));
}

function buildItems(templateId: string, inspectionId: string, state: SeedInspectionState): ChecklistItem[] {
  const template = CHECKLIST_TEMPLATES.find((item) => item.id === templateId) ?? CHECKLIST_TEMPLATES[0];
  const failIndexes = state === 'REJECTED' ? new Set(faker.helpers.arrayElements([...template.items.keys()], { min: 1, max: 2 })) : new Set<number>();
  return template.items.map((item, index) => {
    let result: ChecklistItem['result'];
    if (state === 'DRAFT') {
      result = index < template.items.length / 2 ? 'PASS' : null;
    } else if (failIndexes.has(index)) {
      result = 'FAIL';
    } else {
      result = faker.datatype.boolean({ probability: 0.9 }) ? 'PASS' : 'NA';
    }
    return {
      id: `${inspectionId}-c${index + 1}`,
      criterion: item.criterion,
      requirement: item.requirement,
      result,
      note: result === 'FAIL' ? 'Không đạt yêu cầu, lập punch list khắc phục.' : '',
    };
  });
}

function approvalsFor(state: SeedInspectionState, managerId: string, at: Date): InspectionApprovalRecord[] {
  return INSPECTION_APPROVAL_LEVELS.map(({ level }) => {
    const reviewerId = level === 1 ? managerId : QA_REVIEWER_ID;
    const approved = state === 'APPROVED' || (state === 'IN_REVIEW_L2' && level === 1);
    if (approved) {
      return { level, decision: 'APPROVED', byId: reviewerId, at: addHours(at, 20 * level).toISOString(), note: 'Đạt yêu cầu.' };
    }
    if (state === 'REJECTED' && level === 1) {
      return { level, decision: 'REJECTED', byId: reviewerId, at: addHours(at, 20).toISOString(), note: 'Còn tiêu chí không đạt, khắc phục rồi nghiệm thu lại.' };
    }
    return { level, decision: null, byId: null, at: null, note: '' };
  });
}

function historyFor(state: SeedInspectionState, creatorId: string, approvals: readonly InspectionApprovalRecord[], at: Date): InspectionHistoryRecord[] {
  const history: InspectionHistoryRecord[] = [{ action: 'CREATED', level: null, byId: creatorId, at: at.toISOString(), note: '' }];
  if (state === 'DRAFT') {
    return history;
  }
  history.push({ action: 'SUBMITTED', level: null, byId: creatorId, at: addHours(at, 4).toISOString(), note: '' });
  for (const approval of approvals) {
    if (approval.decision && approval.byId && approval.at) {
      history.push({ action: approval.decision, level: approval.level, byId: approval.byId, at: approval.at, note: approval.note });
    }
  }
  return history;
}

function punchHistory(status: PunchStatus, creatorId: string, assigneeId: string, verifierId: string, createdAt: Date, note: string): PunchHistoryRecord[] {
  const history: PunchHistoryRecord[] = [{ action: 'CREATED', byId: creatorId, at: createdAt.toISOString(), note: '' }];
  if (status === 'OPEN') {
    return history;
  }
  history.push({ action: 'STARTED', byId: assigneeId, at: addHours(createdAt, 18).toISOString(), note: '' });
  if (status === 'IN_PROGRESS') {
    return history;
  }
  history.push({ action: 'RESOLVED', byId: assigneeId, at: addHours(createdAt, 60).toISOString(), note });
  if (status === 'VERIFIED') {
    history.push({ action: 'VERIFIED', byId: verifierId, at: addHours(createdAt, 80).toISOString(), note: 'Đã kiểm tra, đạt.' });
  }
  return history;
}

export function createQualitySeed(projects: readonly ProjectRecord[], wbs: readonly WbsRecord[], floorsOf: (projectId: string) => number, today: Date): QualitySeed {
  const inspections: InspectionRecord[] = [];
  const punchItems: PunchRecord[] = [];

  for (const project of projects) {
    if (!['IN_PROGRESS', 'ON_HOLD', 'COMPLETED'].includes(project.status) || !project.managerId) {
      continue;
    }
    const leaves = leafWbs(wbs, project.id);
    if (leaves.length === 0) {
      continue;
    }
    const managerId = project.managerId;
    const creators = project.memberIds.length ? project.memberIds : [managerId];
    const floors = floorsOf(project.id);
    const location = (): string =>
      floors > 0
        ? faker.helpers.arrayElement(LOCATIONS).replace('{f}', String(faker.number.int({ min: 1, max: floors })))
        : faker.helpers.arrayElement(INFRA_LOCATIONS);
    const templates = floors > 0 ? CHECKLIST_TEMPLATES : CHECKLIST_TEMPLATES.filter((template) => template.id !== 'tpl-masonry');
    const active = project.status === 'IN_PROGRESS';
    const count = project.status === 'COMPLETED' ? 4 : faker.number.int({ min: 6, max: 8 });
    let punchCounter = 0;

    const addPunch = (options: {
      status: PunchStatus;
      createdAt: Date;
      inspectionId: string | null;
      checklistItemId: string | null;
      title?: string;
      description?: string;
      severity?: PunchSeverity;
      location: string;
    }): void => {
      punchCounter += 1;
      const template = faker.helpers.arrayElement(PUNCH_TEMPLATES);
      const id = `pun-${project.id.slice(4)}-${punchCounter}`;
      const assigneeId = faker.helpers.arrayElement(creators);
      const creatorId = faker.helpers.arrayElement(creators);
      const resolveNote = faker.helpers.arrayElement(RESOLVE_NOTES);
      const title = options.title ?? template.title;
      const resolved = options.status === 'RESOLVED' || options.status === 'VERIFIED';
      // Một phần lỗi đang mở đã quá hạn để có dữ liệu cảnh báo.
      const dueDate = options.status === 'VERIFIED' || faker.datatype.boolean({ probability: 0.6 })
        ? addDays(options.createdAt, faker.number.int({ min: 5, max: 14 }))
        : subDays(today, faker.number.int({ min: 1, max: 5 }));
      punchItems.push({
        id,
        code: `PL-${String(punchCounter).padStart(3, '0')}`,
        projectId: project.id,
        inspectionId: options.inspectionId,
        checklistItemId: options.checklistItemId,
        title,
        description: options.description ?? template.description,
        location: options.location,
        severity: options.severity ?? template.severity,
        status: options.status,
        assigneeId,
        dueDate: toIsoDate(dueDate),
        beforePhotos: seedPhotos(`${id}-before`, project, options.createdAt, faker.number.int({ min: 1, max: 2 }), `Hiện trạng: ${title}`),
        afterPhotos: resolved ? seedPhotos(`${id}-after`, project, addHours(options.createdAt, 60), 1, `Sau khắc phục: ${title}`) : [],
        history: punchHistory(options.status, creatorId, assigneeId, managerId, options.createdAt, resolveNote),
        createdById: creatorId,
        createdAt: options.createdAt.toISOString(),
        updatedAt: options.createdAt.toISOString(),
      });
    };

    for (let index = 0; index < count; index++) {
      const recentIndex = index - (count - RECENT_STATES.length);
      const state: SeedInspectionState =
        project.status === 'COMPLETED' || !active || recentIndex < 0 ? 'APPROVED' : RECENT_STATES[recentIndex];
      const daysAgo = project.status === 'COMPLETED' ? 120 - index * 20 : Math.max(1, 60 - index * 8);
      const createdAt = addHours(subDays(today, daysAgo), 9);
      const id = `ins-${project.id.slice(4)}-${index + 1}`;
      const template = faker.helpers.arrayElement(templates);
      const node = faker.helpers.arrayElement(leaves);
      const items = buildItems(template.id, id, state);
      const approvals = approvalsFor(state, managerId, createdAt);
      const creatorId = faker.helpers.arrayElement(creators);
      const where = location();
      const status: InspectionStatus = state === 'IN_REVIEW_L2' ? 'IN_REVIEW' : state;

      inspections.push({
        id,
        code: `NT-${String(index + 1).padStart(3, '0')}`,
        projectId: project.id,
        wbsId: node.id,
        templateId: template.id,
        title: `${template.name} – ${node.name}`,
        location: where,
        inspectionDate: toIsoDate(createdAt),
        items,
        status,
        currentLevel: state === 'IN_REVIEW' ? 1 : state === 'IN_REVIEW_L2' ? 2 : null,
        approvals,
        history: historyFor(state, creatorId, approvals, createdAt),
        createdById: creatorId,
        createdAt: createdAt.toISOString(),
        updatedAt: addHours(createdAt, 40).toISOString(),
      });

      // Tiêu chí không đạt của phiếu bị trả lại sinh punch item cần khắc phục.
      items
        .filter((item) => item.result === 'FAIL')
        .forEach((item, failIndex) =>
          addPunch({
            status: failIndex === 0 ? 'IN_PROGRESS' : 'OPEN',
            createdAt: addHours(createdAt, 22),
            inspectionId: id,
            checklistItemId: item.id,
            title: `${item.criterion} không đạt`,
            description: `Phát hiện khi nghiệm thu: ${item.requirement}.`,
            severity: 'MEDIUM',
            location: where,
          }),
        );
    }

    if (active || project.status === 'ON_HOLD') {
      const statuses: readonly PunchStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'VERIFIED', 'OPEN'];
      statuses.forEach((status, index) =>
        addPunch({
          status,
          createdAt: addHours(subDays(today, 25 - index * 4), 10),
          inspectionId: null,
          checklistItemId: null,
          location: location(),
        }),
      );
    }
  }

  return { inspections, punchItems };
}
