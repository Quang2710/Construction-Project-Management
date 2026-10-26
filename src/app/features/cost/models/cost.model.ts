import { ListParams } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';

export const COST_CATEGORIES = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT', 'OVERHEAD'] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CATEGORY_LABELS: Readonly<Record<CostCategory, string>> = {
  MATERIAL: 'Vật tư',
  LABOR: 'Nhân công',
  EQUIPMENT: 'Máy thi công',
  SUBCONTRACT: 'Thầu phụ',
  OVERHEAD: 'Chi phí chung',
};

/** Dự toán vs thực tế của một hạng mục. */
export interface CostItemSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly budget: number;
  readonly actual: number;
  /** Ngân sách còn lại (âm = vượt). */
  readonly variance: number;
  readonly percentUsed: number;
  /** % hoàn thành khối lượng của hạng mục (từ công việc trong WBS tương ứng). */
  readonly progress: number;
  /** Đã chi vượt quá tỉ lệ khối lượng hoàn thành. */
  readonly overrun: boolean;
}

export interface CostMonthPoint {
  /** "MM/yyyy" */
  readonly month: string;
  readonly cost: number;
  readonly received: number;
}

/** Tổng hợp tài chính dự án. Các trường lãi/lỗ là null với CLIENT (thông tin nội bộ nhà thầu). */
export interface CostSummary {
  readonly projectId: string;
  readonly projectCode: string;
  readonly projectName: string;
  readonly originalContract: number;
  readonly approvedChanges: number;
  readonly contractValue: number;
  readonly costBudget: number;
  readonly actualCost: number;
  readonly progress: number;
  /** Doanh thu ghi nhận theo % hoàn thành. */
  readonly earnedRevenue: number;
  readonly billed: number;
  readonly received: number;
  readonly receivable: number;
  readonly profitToDate: number | null;
  /** Chi phí dự báo khi hoàn thành (EAC). */
  readonly forecastCost: number | null;
  readonly forecastProfit: number | null;
  readonly forecastMargin: number | null;
  readonly items: readonly CostItemSummary[];
  readonly byCategory: readonly { readonly category: CostCategory; readonly amount: number }[];
  readonly monthly: readonly CostMonthPoint[];
}

export interface CostEntry {
  readonly id: string;
  readonly projectId: string;
  readonly costItemId: string;
  readonly costItemName: string;
  /** yyyy-MM-dd */
  readonly date: string;
  readonly category: CostCategory;
  readonly description: string;
  readonly vendor: string;
  readonly documentNo: string;
  readonly amount: number;
  readonly createdBy: UserSummary;
  readonly createdAt: string;
}

export type CostEntryCreate = Omit<CostEntry, 'id' | 'projectId' | 'costItemName' | 'createdBy' | 'createdAt'>;

export interface CostEntryListParams extends ListParams {
  readonly costItemId?: string | null;
  readonly category?: CostCategory | null;
}

export const CHANGE_ORDER_STATUSES = ['PROPOSED', 'APPROVED', 'REJECTED'] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export const CHANGE_ORDER_STATUS_LABELS: Readonly<Record<ChangeOrderStatus, string>> = {
  PROPOSED: 'Đề xuất',
  APPROVED: 'Đã chấp thuận',
  REJECTED: 'Không chấp thuận',
};

/** Chi phí phát sinh (thay đổi so với hợp đồng). */
export interface ChangeOrder {
  readonly id: string;
  readonly projectId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly costItemId: string;
  readonly costItemName: string;
  /** Chi phí thực hiện tăng thêm (cộng vào dự toán hạng mục khi chấp thuận). */
  readonly costAmount: number;
  /** Giá trị chủ đầu tư chấp thuận thanh toán thêm (tăng giá trị hợp đồng). */
  readonly revenueAmount: number;
  readonly status: ChangeOrderStatus;
  readonly date: string;
  readonly decisionNote: string;
  readonly createdBy: UserSummary;
}

export type ChangeOrderCreate = Pick<ChangeOrder, 'title' | 'description' | 'costItemId' | 'costAmount' | 'revenueAmount' | 'date'>;

export const PAYMENT_STATUSES = ['PLANNED', 'INVOICED', 'PAID'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  PLANNED: 'Chưa đến hạn',
  INVOICED: 'Đã đề nghị thanh toán',
  PAID: 'Đã thanh toán',
};

/** Đợt thanh toán của chủ đầu tư cho nhà thầu. */
export interface PaymentMilestone {
  readonly id: string;
  readonly projectId: string;
  readonly order: number;
  readonly name: string;
  /** % giá trị hợp đồng gốc. */
  readonly percent: number;
  readonly amount: number;
  readonly dueDate: string;
  readonly status: PaymentStatus;
  readonly invoicedAt: string | null;
  readonly paidAt: string | null;
  readonly paidAmount: number;
  readonly isOverdue: boolean;
}

/** Chuyển trạng thái đợt: PLANNED → INVOICED → PAID (paidAmount mặc định = giá trị đợt). */
export type PaymentUpdateRequest =
  | { readonly status: 'INVOICED' }
  | { readonly status: 'PAID'; readonly paidAmount: number };

/** Một dòng báo cáo lãi/lỗ toàn danh mục. */
export type ProfitLossRow = Omit<CostSummary, 'items' | 'byCategory' | 'monthly'> & { readonly status: string };
