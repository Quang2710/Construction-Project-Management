import { faker } from '@faker-js/faker/locale/vi';
import { addDays, addHours, subDays } from 'date-fns';
import { MaterialRequestStatus } from '../../features/materials/models/material.model';
import { toIsoDate } from '../../shared/utils/date.utils';
import {
  MaterialRecord,
  MaterialRequestRecord,
  ProjectRecord,
  StockRecord,
  StockTransactionRecord,
} from '../models/mock-records';

/** Danh mục vật tư phổ biến, đơn giá tham khảo thị trường (VND). */
export const MATERIAL_CATALOG: readonly MaterialRecord[] = [
  { id: 'mat-xm-pcb40', code: 'XM-PCB40', name: 'Xi măng PCB40 (bao 50kg)', unit: 'bao', category: 'CEMENT', unitPrice: 92_000, description: 'Xi măng hỗn hợp dùng cho bê tông, vữa xây trát.' },
  { id: 'mat-xm-pc40', code: 'XM-PC40-XA', name: 'Xi măng PC40 rời', unit: 'tấn', category: 'CEMENT', unitPrice: 1_450_000, description: 'Xi măng rời cấp vào silo trạm trộn.' },
  { id: 'mat-thep-d10', code: 'TH-CB300-D10', name: 'Thép CB300-V D10', unit: 'kg', category: 'STEEL', unitPrice: 15_200, description: 'Thép thanh vằn, dùng cho cốt đai, sàn.' },
  { id: 'mat-thep-d16', code: 'TH-CB400-D16', name: 'Thép CB400-V D16', unit: 'kg', category: 'STEEL', unitPrice: 15_000, description: 'Thép thanh vằn cho dầm, cột.' },
  { id: 'mat-thep-d25', code: 'TH-CB400-D25', name: 'Thép CB400-V D25', unit: 'kg', category: 'STEEL', unitPrice: 14_900, description: 'Thép thanh vằn cho cọc, cột chịu lực lớn.' },
  { id: 'mat-thep-i200', code: 'TH-I200', name: 'Thép hình I200', unit: 'kg', category: 'STEEL', unitPrice: 18_500, description: 'Thép hình cho kết cấu nhà xưởng, cầu.' },
  { id: 'mat-thep-buoc', code: 'TH-BUOC-1LY', name: 'Dây thép buộc 1 ly', unit: 'kg', category: 'STEEL', unitPrice: 24_000, description: '' },
  { id: 'mat-cat-vang', code: 'CD-CATVANG', name: 'Cát vàng bê tông', unit: 'm³', category: 'AGGREGATE', unitPrice: 420_000, description: 'Cát hạt to cho bê tông.' },
  { id: 'mat-cat-xay', code: 'CD-CATXAY', name: 'Cát xây trát', unit: 'm³', category: 'AGGREGATE', unitPrice: 280_000, description: '' },
  { id: 'mat-da-12', code: 'CD-DA1X2', name: 'Đá dăm 1x2', unit: 'm³', category: 'AGGREGATE', unitPrice: 380_000, description: 'Cốt liệu cho bê tông.' },
  { id: 'mat-da-46', code: 'CD-DA4X6', name: 'Đá 4x6', unit: 'm³', category: 'AGGREGATE', unitPrice: 330_000, description: 'Đá lót móng, nền đường.' },
  { id: 'mat-bt-m300', code: 'BT-M300', name: 'Bê tông thương phẩm M300', unit: 'm³', category: 'CONCRETE', unitPrice: 1_250_000, description: 'Bê tông trộn sẵn, giao bằng xe bồn.' },
  { id: 'mat-bt-m400', code: 'BT-M400', name: 'Bê tông thương phẩm M400', unit: 'm³', category: 'CONCRETE', unitPrice: 1_420_000, description: '' },
  { id: 'mat-gach-dac', code: 'GA-DAC-A1', name: 'Gạch đặc A1', unit: 'viên', category: 'BRICK', unitPrice: 1_350, description: 'Gạch nung đặc 220x105x60.' },
  { id: 'mat-gach-block', code: 'GA-BLOCK-10', name: 'Gạch block bê tông 10cm', unit: 'viên', category: 'BRICK', unitPrice: 9_500, description: '' },
  { id: 'mat-gach-6060', code: 'GA-PORC-6060', name: 'Gạch porcelain 60x60', unit: 'm²', category: 'BRICK', unitPrice: 210_000, description: 'Gạch lát nền.' },
  { id: 'mat-day-cv25', code: 'DI-CV2.5', name: 'Dây điện CV 2.5mm²', unit: 'm', category: 'ELECTRICAL', unitPrice: 9_800, description: '' },
  { id: 'mat-cap-cxv', code: 'DI-CXV4X25', name: 'Cáp đồng CXV 4x25mm²', unit: 'm', category: 'ELECTRICAL', unitPrice: 420_000, description: 'Cáp trục đứng.' },
  { id: 'mat-ong-luon', code: 'DI-PVC-D20', name: 'Ống luồn dây PVC D20', unit: 'm', category: 'ELECTRICAL', unitPrice: 6_500, description: '' },
  { id: 'mat-ong-ppr', code: 'NU-PPR-D25', name: 'Ống PPR D25', unit: 'm', category: 'PLUMBING', unitPrice: 32_000, description: 'Ống cấp nước nóng lạnh.' },
  { id: 'mat-ong-upvc', code: 'NU-UPVC-D110', name: 'Ống uPVC D110', unit: 'm', category: 'PLUMBING', unitPrice: 98_000, description: 'Ống thoát nước.' },
  { id: 'mat-son-noi', code: 'HT-SON-NT', name: 'Sơn nội thất (thùng 18L)', unit: 'thùng', category: 'FINISHING', unitPrice: 1_850_000, description: '' },
  { id: 'mat-bot-ba', code: 'HT-BOTBA', name: 'Bột bả tường (bao 40kg)', unit: 'bao', category: 'FINISHING', unitPrice: 220_000, description: '' },
  { id: 'mat-van-khuon', code: 'KH-VANPHIM', name: 'Ván khuôn phủ phim 18mm', unit: 'tấm', category: 'OTHER', unitPrice: 380_000, description: 'Ván cốp pha 1220x2440.' },
];

/** Khoảng tồn kho điển hình [min, max] và mức tối thiểu theo đơn vị. */
const STOCK_PROFILE: Readonly<Record<string, readonly [number, number, number]>> = {
  bao: [80, 900, 150],
  tấn: [5, 60, 10],
  kg: [1_500, 25_000, 3_000],
  'm³': [10, 180, 25],
  viên: [2_000, 40_000, 5_000],
  'm²': [50, 800, 100],
  m: [200, 3_000, 300],
  thùng: [5, 60, 10],
  tấm: [30, 400, 60],
};

const INFRA_CATEGORIES = new Set(['CEMENT', 'STEEL', 'AGGREGATE', 'CONCRETE', 'ELECTRICAL', 'PLUMBING', 'OTHER']);

const ISSUE_NOTES = [
  'Xuất cho tổ cốt thép thi công sàn',
  'Xuất cho tổ bê tông đổ cột',
  'Xuất cho tổ nề xây tường',
  'Xuất cho tổ điện nước',
  'Xuất cho tổ hoàn thiện',
];

function roundNice(value: number): number {
  const magnitude = value >= 1000 ? 100 : value >= 100 ? 10 : 1;
  return Math.max(1, Math.round(value / magnitude) * magnitude);
}

export interface MaterialSeed {
  readonly stock: StockRecord[];
  readonly stockTransactions: StockTransactionRecord[];
  readonly materialRequests: MaterialRequestRecord[];
}

/**
 * Tồn kho + lịch sử nhập/xuất 30 ngày cho các công trường đang thi công/tạm dừng.
 * Lịch sử được dựng ngược từ số tồn cuối nên luôn khớp (không bao giờ âm).
 */
export function createMaterialSeed(projects: readonly ProjectRecord[], today: Date): MaterialSeed {
  const stock: StockRecord[] = [];
  const stockTransactions: StockTransactionRecord[] = [];
  const materialRequests: MaterialRequestRecord[] = [];
  let txCounter = 0;
  let requestCounter = 0;
  const nextTxCode = (type: 'IN' | 'OUT'): string => `${type === 'IN' ? 'PN' : 'PX'}-${String(++txCounter).padStart(5, '0')}`;

  for (const project of projects.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'ON_HOLD')) {
    const isBuilding = !['prj-cvmd', 'prj-lgdv'].includes(project.id);
    const materials = MATERIAL_CATALOG.filter((material) => isBuilding || INFRA_CATEGORIES.has(material.category));
    const people = [project.managerId ?? 'usr-pm', ...project.memberIds];

    for (const material of faker.helpers.arrayElements(materials, { min: 12, max: materials.length })) {
      const [low, high, minLevel] = STOCK_PROFILE[material.unit] ?? [10, 100, 20];
      const minQuantity = roundNice(minLevel);
      // ~20% vật tư dưới mức tối thiểu để có cảnh báo.
      const quantity = faker.datatype.boolean({ probability: 0.2 })
        ? roundNice(faker.number.int({ min: 0, max: Math.max(1, minQuantity - 1) }))
        : roundNice(faker.number.int({ min: Math.max(minQuantity, low), max: high }));
      const finalQuantity = quantity;

      // Dựng lịch sử: 2–3 lần nhập đầu kỳ, rải các lần xuất sau đó.
      const outs = Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () =>
        roundNice(faker.number.int({ min: Math.max(1, Math.round(low / 4)), max: Math.max(2, Math.round(high / 5)) })),
      );
      const totalIn = finalQuantity + outs.reduce((sum, value) => sum + value, 0);
      const inCount = faker.number.int({ min: 1, max: 3 });
      const ins = Array.from({ length: inCount }, (_, index) =>
        index === inCount - 1 ? 0 : roundNice(totalIn / inCount),
      );
      ins[inCount - 1] = totalIn - ins.slice(0, -1).reduce((sum, value) => sum + value, 0);

      const events = [
        ...ins.map((value, index) => ({ type: 'IN' as const, quantity: value, day: 30 - index * 6 })),
        ...outs.map((value, index) => ({ type: 'OUT' as const, quantity: value, day: 28 - index * 4 - faker.number.int({ min: 0, max: 2 }) })),
      ]
        .filter((event) => event.quantity > 0)
        .sort((a, b) => b.day - a.day || (a.type === 'IN' ? -1 : 1));

      let balance = 0;
      for (const event of events) {
        // Nếu xuất vượt tồn (do sắp xếp ngày), dời lần xuất ra sau lần nhập kế tiếp bằng cách giới hạn.
        const quantityMoved = event.type === 'OUT' ? Math.min(event.quantity, balance) : event.quantity;
        if (quantityMoved <= 0) {
          continue;
        }
        balance += event.type === 'IN' ? quantityMoved : -quantityMoved;
        stockTransactions.push({
          id: `stx-${txCounter + 1}`,
          code: nextTxCode(event.type),
          projectId: project.id,
          materialId: material.id,
          type: event.type,
          quantity: quantityMoved,
          unitPrice: material.unitPrice,
          balanceAfter: balance,
          note: event.type === 'IN' ? 'Nhập kho từ nhà cung cấp' : faker.helpers.arrayElement(ISSUE_NOTES),
          requestId: null,
          createdById: faker.helpers.arrayElement(people),
          createdAt: addHours(subDays(today, Math.max(0, event.day)), faker.number.int({ min: 7, max: 17 })).toISOString(),
        });
      }

      stock.push({
        id: `${project.id}:${material.id}`,
        projectId: project.id,
        materialId: material.id,
        quantity: balance,
        minQuantity,
        updatedAt: today.toISOString(),
      });
    }

    // Phiếu yêu cầu: vài phiếu mỗi công trường, đủ các trạng thái.
    const statuses: MaterialRequestStatus[] = ['RECEIVED', 'RECEIVED', 'APPROVED', 'PENDING', 'REJECTED'];
    for (const [index, status] of statuses.slice(0, faker.number.int({ min: 2, max: 5 })).entries()) {
      requestCounter += 1;
      const createdAt = addHours(subDays(today, 20 - index * 4), 9);
      const authorId = faker.helpers.arrayElement(project.memberIds.length ? project.memberIds : people);
      const reviewerId = project.managerId ?? 'usr-pm';
      const items = faker.helpers.arrayElements(materials, { min: 1, max: 4 }).map((material) => {
        const [low, high] = STOCK_PROFILE[material.unit] ?? [10, 100];
        return { materialId: material.id, quantity: roundNice(faker.number.int({ min: low, max: Math.round((low + high) / 2) })), unitPrice: material.unitPrice };
      });
      const history: MaterialRequestRecord['history'][number][] = [
        { action: 'CREATED', byId: authorId, at: createdAt.toISOString(), note: '' },
      ];
      if (status !== 'PENDING') {
        history.push({
          action: status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
          byId: reviewerId,
          at: addHours(createdAt, 5).toISOString(),
          note: status === 'REJECTED' ? 'Khối lượng vượt dự toán, đề nghị lập lại.' : 'Đồng ý cấp.',
        });
      }
      if (status === 'RECEIVED') {
        history.push({ action: 'RECEIVED', byId: authorId, at: addHours(createdAt, 30).toISOString(), note: 'Đã kiểm đếm, nhập kho đủ.' });
      }
      materialRequests.push({
        id: `mrq-${requestCounter}`,
        code: `YC-${String(requestCounter).padStart(4, '0')}`,
        projectId: project.id,
        items,
        neededBy: toIsoDate(addDays(createdAt, 5)),
        note: faker.helpers.arrayElement(['Phục vụ đổ bê tông sàn', 'Bổ sung vật tư cho tổ hoàn thiện', 'Chuẩn bị thi công đợt tiếp theo', '']),
        status,
        createdById: authorId,
        reviewNote: history.find((entry) => entry.action === 'APPROVED' || entry.action === 'REJECTED')?.note ?? '',
        history,
        createdAt: createdAt.toISOString(),
      });
    }
  }
  return { stock, stockTransactions, materialRequests };
}
