import { utils, WorkSheet } from 'xlsx';
import { UserSummary } from '../../../shared/models/user.model';
import { ChangeOrder, CostEntry, CostSummary, PaymentMilestone, ProfitLossRow } from '../models/cost.model';
import { buildProfitLossWorkbook, buildProjectCostWorkbook } from './cost-excel';

const USER: UserSummary = { id: 'u1', fullName: 'Nguyễn Văn A', jobTitle: '', role: 'PROJECT_MANAGER' };

const SUMMARY: CostSummary = {
  projectId: 'prj-1',
  projectCode: 'GTHM',
  projectName: 'Chung cư Gò Vấp',
  originalContract: 1_000_000_000,
  approvedChanges: 100_000_000,
  contractValue: 1_100_000_000,
  costBudget: 900_000_000,
  actualCost: 500_000_000,
  progress: 50,
  earnedRevenue: 550_000_000,
  billed: 400_000_000,
  received: 300_000_000,
  receivable: 100_000_000,
  profitToDate: 50_000_000,
  forecastCost: 1_000_000_000,
  forecastProfit: 100_000_000,
  forecastMargin: 9.1,
  items: [
    { id: 'i1', code: '01', name: 'Phần móng', budget: 400_000_000, actual: 450_000_000, variance: -50_000_000, percentUsed: 113, progress: 90, overrun: true },
    { id: 'i2', code: '02', name: 'Phần thân', budget: 500_000_000, actual: 50_000_000, variance: 450_000_000, percentUsed: 10, progress: 15, overrun: false },
  ],
  byCategory: [],
  monthly: [],
};

const ENTRY: CostEntry = {
  id: 'e1',
  projectId: 'prj-1',
  costItemId: 'i1',
  costItemName: 'Phần móng',
  date: '2026-03-05',
  category: 'MATERIAL',
  description: 'Bê tông M300',
  vendor: 'Bê tông Việt',
  documentNo: 'HD-9',
  amount: 450_000_000,
  createdBy: USER,
  createdAt: '',
};

const ORDER: ChangeOrder = {
  id: 'c1',
  projectId: 'prj-1',
  code: 'PS-01',
  title: 'Bổ sung cọc',
  description: '',
  costItemId: 'i1',
  costItemName: 'Phần móng',
  costAmount: 80_000_000,
  revenueAmount: 100_000_000,
  status: 'APPROVED',
  date: '2026-02-01',
  decisionNote: '',
  createdBy: USER,
};

const PAYMENT: PaymentMilestone = {
  id: 'p1',
  projectId: 'prj-1',
  order: 1,
  name: 'Tạm ứng',
  percent: 30,
  amount: 300_000_000,
  dueDate: '2026-01-15',
  status: 'PAID',
  invoicedAt: '2026-01-10',
  paidAt: '2026-01-20',
  paidAmount: 300_000_000,
  isOverdue: false,
};

function rows(sheet: WorkSheet | undefined): unknown[][] {
  return sheet ? utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) : [];
}

describe('cost-excel', () => {
  const data = { summary: SUMMARY, entries: [ENTRY], changeOrders: [ORDER], payments: [PAYMENT] };

  it('workbook dự án có đủ 5 sheet tiếng Việt', () => {
    const book = buildProjectCostWorkbook(data, new Date(2026, 9, 26));
    expect(book.SheetNames).toEqual(['Tổng hợp', 'Dự toán vs thực tế', 'Chi phí thực tế', 'Phát sinh', 'Thanh toán']);
  });

  it('sheet hạng mục: giá trị số (không phải chuỗi), định dạng tiền, cảnh báo và dòng tổng', () => {
    const sheet = buildProjectCostWorkbook(data).Sheets['Dự toán vs thực tế'];
    const table = rows(sheet);
    expect(table[0]).toEqual(['Mã', 'Hạng mục', 'Dự toán', 'Thực tế', 'Còn lại', '% đã chi', '% khối lượng', 'Cảnh báo']);
    expect(table[1]).toEqual(['01', 'Phần móng', 400_000_000, 450_000_000, -50_000_000, 113, 90, 'Vượt dự toán']);
    // Ô null được để trống trong sheet.
    expect(table[3]).toEqual(['', 'Tổng cộng', 900_000_000, 500_000_000, 400_000_000, undefined, undefined, '']);
    expect(sheet?.['C2']).toMatchObject({ t: 'n', z: '#,##0' });
    // Vùng lọc không bao gồm dòng tổng.
    expect(sheet?.['!autofilter']).toEqual({ ref: 'A1:H3' });
  });

  it('ngày hiển thị dd/MM/yyyy, nhãn trạng thái tiếng Việt', () => {
    const book = buildProjectCostWorkbook(data);
    expect(rows(book.Sheets['Chi phí thực tế'])[1]).toEqual(
      expect.arrayContaining(['05/03/2026', 'HD-9', 'Vật tư', 'Bê tông M300', 450_000_000, 'Nguyễn Văn A']),
    );
    expect(rows(book.Sheets['Phát sinh'])[1]).toContain('Đã chấp thuận');
    expect(rows(book.Sheets['Thanh toán'])[1]).toContain('Đã thanh toán');
  });

  it('bỏ chỉ số lãi/lỗ khi người xem không có quyền (null)', () => {
    const client = { ...SUMMARY, profitToDate: null, forecastCost: null, forecastProfit: null, forecastMargin: null };
    const labels = rows(buildProjectCostWorkbook({ ...data, summary: client }).Sheets['Tổng hợp']).map((row) => row[0]);
    expect(labels).toContain('Chi phí thực tế');
    expect(labels).not.toContain('Lãi/lỗ dự báo');

    const full = rows(buildProjectCostWorkbook(data).Sheets['Tổng hợp']).map((row) => row[0]);
    expect(full).toContain('Lãi/lỗ dự báo');
  });

  it('báo cáo lãi/lỗ toàn danh mục có dòng tổng', () => {
    const { items: _items, byCategory: _byCategory, monthly: _monthly, ...base } = SUMMARY;
    const row: ProfitLossRow = { ...base, status: 'Đang thi công' };
    const table = rows(buildProfitLossWorkbook([row, { ...row, projectId: 'prj-2', projectCode: 'B', forecastProfit: -30_000_000 }]).Sheets['Lãi lỗ']);
    expect(table).toHaveLength(4);
    expect(table[3][1]).toBe('Tổng cộng');
    expect(table[3][12]).toBe(70_000_000);
  });
});
