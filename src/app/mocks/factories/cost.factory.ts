import { faker } from '@faker-js/faker/locale/vi';
import { addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import { ChangeOrderStatus, CostCategory, PaymentStatus } from '../../features/cost/models/cost.model';
import { parseIsoDate, toIsoDate } from '../../shared/utils/date.utils';
import {
  ChangeOrderRecord,
  ContractRecord,
  CostEntryRecord,
  CostItemRecord,
  PaymentRecord,
  ProjectRecord,
  TaskRecord,
  WbsRecord,
} from '../models/mock-records';
import { costItemProgress, roundTo } from '../utils/cost-metrics';
import { actualProgress } from '../utils/project-metrics';

/** Biên lợi nhuận kỳ vọng: giá trị hợp đồng ≈ dự toán chi phí × 1.12. */
export const CONTRACT_MARKUP = 1.12;
const MILLION = 1_000_000;

/** Tỉ trọng dự toán theo hạng mục WBS cấp 1 (theo thứ tự), phần còn lại là chi phí chung. */
const BUILDING_WEIGHTS = [0.04, 0.18, 0.38, 0.2, 0.14];
const INFRA_WEIGHTS = [0.05, 0.3, 0.35, 0.15, 0.09];

const ITEM_CATEGORIES: readonly (readonly CostCategory[])[] = [
  ['SUBCONTRACT', 'OVERHEAD'],
  ['MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'LABOR'],
  ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT'],
  ['MATERIAL', 'SUBCONTRACT', 'LABOR'],
  ['MATERIAL', 'LABOR', 'SUBCONTRACT'],
];

const VENDORS: Readonly<Record<CostCategory, readonly string[]>> = {
  MATERIAL: ['Công ty CP Thép Hòa Phát', 'Công ty TNHH Bê tông Việt Đức', 'Tổng công ty Viglacera', 'Công ty CP Xi măng Vicem'],
  LABOR: ['Đội thi công Nguyễn Văn Hải', 'Tổ đội Trần Minh Tuấn', 'Đội nề Lê Văn Phúc'],
  EQUIPMENT: ['Công ty CP Máy xây dựng Đông Á', 'Công ty TNHH Cho thuê cẩu Hưng Thịnh'],
  SUBCONTRACT: ['Công ty CP Cơ điện Lạnh REE', 'Công ty TNHH Xây dựng Phú Thành', 'Công ty CP Nền móng Đại Phong'],
  OVERHEAD: ['Ban chỉ huy công trường', 'Công ty Bảo hiểm Bảo Việt', 'Điện lực khu vực'],
};

const DESCRIPTIONS: Readonly<Record<CostCategory, readonly string[]>> = {
  MATERIAL: ['Thanh toán thép theo hoá đơn', 'Bê tông thương phẩm đợt', 'Vật tư hoàn thiện', 'Xi măng, cát, đá'],
  LABOR: ['Lương nhân công tháng', 'Khoán nhân công hạng mục', 'Tăng ca đẩy tiến độ'],
  EQUIPMENT: ['Thuê cần trục tháp', 'Thuê máy đào, máy lu', 'Nhiên liệu máy thi công'],
  SUBCONTRACT: ['Thanh toán thầu phụ đợt', 'Tạm ứng thầu phụ', 'Nghiệm thu khối lượng thầu phụ'],
  OVERHEAD: ['Lương ban chỉ huy', 'Bảo hiểm công trình', 'Điện nước thi công', 'Lán trại, an ninh'],
};

const PAYMENT_PLAN: readonly { name: string; percent: number; trigger: number }[] = [
  { name: 'Đợt 1 – Tạm ứng hợp đồng', percent: 15, trigger: 0 },
  { name: 'Đợt 2 – Hoàn thành phần ngầm', percent: 15, trigger: 0.25 },
  { name: 'Đợt 3 – Hoàn thành phần thân', percent: 25, trigger: 0.55 },
  { name: 'Đợt 4 – Hoàn thành cơ điện, hoàn thiện', percent: 25, trigger: 0.8 },
  { name: 'Đợt 5 – Nghiệm thu bàn giao', percent: 15, trigger: 1 },
  { name: 'Đợt 6 – Hoàn trả bảo hành (12 tháng)', percent: 5, trigger: 2 },
];

const CHANGE_TEMPLATES: readonly { title: string; description: string; itemIndex: number; share: number }[] = [
  { title: 'Gia cố nền do địa chất yếu hơn hồ sơ khảo sát', description: 'Bổ sung cọc và đệm cát theo yêu cầu tư vấn thiết kế.', itemIndex: 1, share: 0.025 },
  { title: 'Đổi vật liệu ốp mặt tiền theo yêu cầu chủ đầu tư', description: 'Thay đá granite bằng tấm nhôm composite cao cấp.', itemIndex: 4, share: 0.015 },
  { title: 'Bổ sung hệ thống điện mặt trời áp mái', description: 'Lắp 120 kWp pin mặt trời và inverter hoà lưới.', itemIndex: 3, share: 0.02 },
  { title: 'Tăng ca rút ngắn tiến độ 30 ngày', description: 'Chi phí nhân công ngoài giờ theo đề nghị chủ đầu tư.', itemIndex: 2, share: 0.01 },
];

export interface CostSeed {
  readonly contracts: ContractRecord[];
  readonly costItems: CostItemRecord[];
  readonly costEntries: CostEntryRecord[];
  readonly changeOrders: ChangeOrderRecord[];
  readonly payments: PaymentRecord[];
  /** Ngân sách dự án sau khi cộng phát sinh đã chấp thuận. */
  readonly budgets: ReadonlyMap<string, number>;
}

/** Chia `total` thành `count` phần ngẫu nhiên (bội số `step`), tổng đúng bằng `total`. */
function split(total: number, count: number, step: number): number[] {
  const weights = Array.from({ length: count }, () => faker.number.float({ min: 0.5, max: 1.5 }));
  const sum = weights.reduce((acc, value) => acc + value, 0);
  const parts = weights.slice(0, -1).map((weight) => roundTo((total * weight) / sum, step));
  return [...parts, total - parts.reduce((acc, value) => acc + value, 0)];
}

export function createCostSeed(
  projects: readonly ProjectRecord[],
  wbs: readonly WbsRecord[],
  tasks: readonly TaskRecord[],
  today: Date,
): CostSeed {
  const seed: { -readonly [K in keyof CostSeed]: CostSeed[K] } = {
    contracts: [],
    costItems: [],
    costEntries: [],
    changeOrders: [],
    payments: [],
    budgets: new Map(),
  };
  const budgets = new Map<string, number>();
  let entryCounter = 0;
  let changeCounter = 0;

  for (const project of projects) {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const roots = wbs.filter((node) => node.projectId === project.id && node.parentId === null).sort((a, b) => a.order - b.order);
    const weights = ['prj-cvmd', 'prj-lgdv'].includes(project.id) ? INFRA_WEIGHTS : BUILDING_WEIGHTS;
    const originalContract = roundTo(project.budget * CONTRACT_MARKUP, MILLION);
    seed.contracts.push({ id: project.id, projectId: project.id, originalContract });

    // Dự toán theo hạng mục: tổng đúng bằng ngân sách dự án.
    const items: CostItemRecord[] = roots.map((node, index) => ({
      id: `cit-${node.id}`,
      projectId: project.id,
      code: String(index + 1),
      name: node.name,
      budget: roundTo(project.budget * (weights[index] ?? 0.05), MILLION),
      wbsId: node.id,
      order: index + 1,
    }));
    const allocated = items.reduce((sum, item) => sum + item.budget, 0);
    items.push({
      id: `cit-${project.id}-overhead`,
      projectId: project.id,
      code: String(items.length + 1),
      name: 'Chi phí chung và quản lý công trường',
      budget: project.budget - allocated,
      wbsId: null,
      order: items.length + 1,
    });

    // Phát sinh: đã chấp thuận thì cộng vào dự toán hạng mục.
    let budget = project.budget;
    if (project.status === 'IN_PROGRESS' || project.status === 'ON_HOLD' || project.status === 'COMPLETED') {
      const statuses: ChangeOrderStatus[] = ['APPROVED', 'PROPOSED', 'REJECTED'];
      for (const [index, template] of faker.helpers.arrayElements(CHANGE_TEMPLATES, { min: 1, max: 3 }).entries()) {
        const item = items[Math.min(template.itemIndex, items.length - 1)];
        const costAmount = roundTo(project.budget * template.share, MILLION);
        const status = project.status === 'COMPLETED' ? 'APPROVED' : statuses[index % statuses.length];
        changeCounter += 1;
        seed.changeOrders.push({
          id: `cho-${changeCounter}`,
          projectId: project.id,
          code: `PS-${String(index + 1).padStart(2, '0')}`,
          title: template.title,
          description: template.description,
          costItemId: item.id,
          costAmount,
          revenueAmount: roundTo(costAmount * 1.15, MILLION),
          status,
          date: toIsoDate(addDays(parseIsoDate(project.startDate), 30 + index * 45)),
          decisionNote: status === 'APPROVED' ? 'Chủ đầu tư chấp thuận theo biên bản họp.' : status === 'REJECTED' ? 'Không thuộc phạm vi hợp đồng.' : '',
          createdById: project.managerId ?? 'usr-pm',
        });
        if (status === 'APPROVED') {
          const target = items.indexOf(item);
          items[target] = { ...item, budget: item.budget + costAmount };
          budget += costAmount;
        }
      }
    }
    budgets.set(project.id, budget);
    seed.costItems.push(...items);

    // Chi phí thực tế: phân bổ theo dự toán × % khối lượng của từng hạng mục, tổng = actualCost.
    if (project.actualCost > 0) {
      const raw = items.map((item) => item.budget * (costItemProgress(item.wbsId, wbs, projectTasks) / 100 + 0.02) * faker.number.float({ min: 0.85, max: 1.25 }));
      const rawTotal = raw.reduce((sum, value) => sum + value, 0) || 1;
      const actuals = raw.slice(0, -1).map((value) => roundTo((project.actualCost * value) / rawTotal, 1000));
      actuals.push(project.actualCost - actuals.reduce((sum, value) => sum + value, 0));

      const start = parseIsoDate(project.startDate);
      const lastDay = Math.max(1, Math.min(differenceInCalendarDays(today, start), differenceInCalendarDays(parseIsoDate(project.endDate), start)));
      items.forEach((item, index) => {
        const amount = actuals[index];
        if (amount <= 0) {
          return;
        }
        const categories = item.wbsId ? ITEM_CATEGORIES[index] ?? ['MATERIAL'] : (['OVERHEAD'] as const);
        split(amount, faker.number.int({ min: 3, max: 7 }), 1000).forEach((part) => {
          const category = faker.helpers.arrayElement(categories);
          entryCounter += 1;
          const date = toIsoDate(addDays(start, faker.number.int({ min: 0, max: lastDay })));
          seed.costEntries.push({
            id: `cen-${entryCounter}`,
            projectId: project.id,
            costItemId: item.id,
            date,
            category,
            description: `${faker.helpers.arrayElement(DESCRIPTIONS[category])} – ${item.name.toLowerCase()}`,
            vendor: faker.helpers.arrayElement(VENDORS[category]),
            documentNo: `${category === 'OVERHEAD' ? 'PC' : 'HĐ'}-${String(10_000 + entryCounter)}`,
            amount: part,
            createdById: project.managerId ?? 'usr-pm',
            createdAt: `${date}T09:00:00.000Z`,
          });
        });
      });
    }

    // Đợt thanh toán theo tiến độ.
    const progress = actualProgress(projectTasks) / 100;
    const start = parseIsoDate(project.startDate);
    const durationDays = differenceInCalendarDays(parseIsoDate(project.endDate), start);
    let invoicedOne = false;
    PAYMENT_PLAN.forEach((plan, index) => {
      const dueDate =
        plan.trigger > 1 ? addMonths(parseIsoDate(project.endDate), 12) : addDays(start, Math.round(plan.trigger * durationDays));
      const reached =
        project.status === 'COMPLETED' ? plan.trigger <= 1 : project.status !== 'PLANNING' && progress >= plan.trigger;
      let status: PaymentStatus = 'PLANNED';
      // Đợt vừa đạt gần nhất có thể chưa được chủ đầu tư chuyển tiền.
      const nextTrigger = PAYMENT_PLAN[index + 1]?.trigger ?? 9;
      if (reached && !invoicedOne && progress < nextTrigger && project.status !== 'COMPLETED' && plan.trigger > 0) {
        status = 'INVOICED';
        invoicedOne = true;
      } else if (reached) {
        status = 'PAID';
      }
      const amount = roundTo((originalContract * plan.percent) / 100, MILLION);
      const invoicedAt = status === 'PLANNED' ? null : toIsoDate(dueDate <= today ? dueDate : today);
      const paidDate = invoicedAt ? addDays(parseIsoDate(invoicedAt), 18) : null;
      seed.payments.push({
        id: `pay-${project.id}-${index + 1}`,
        projectId: project.id,
        order: index + 1,
        name: plan.name,
        percent: plan.percent,
        amount,
        dueDate: toIsoDate(dueDate),
        status,
        invoicedAt,
        paidAt: status === 'PAID' && paidDate ? toIsoDate(paidDate > today ? today : paidDate) : null,
        paidAmount: status === 'PAID' ? amount : 0,
      });
    });
  }
  return { ...seed, budgets };
}
