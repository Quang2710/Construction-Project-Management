import { ListParams } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';

export const MATERIAL_CATEGORIES = ['CEMENT', 'STEEL', 'AGGREGATE', 'CONCRETE', 'BRICK', 'ELECTRICAL', 'PLUMBING', 'FINISHING', 'OTHER'] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_CATEGORY_LABELS: Readonly<Record<MaterialCategory, string>> = {
  CEMENT: 'Xi măng',
  STEEL: 'Sắt thép',
  AGGREGATE: 'Cát, đá',
  CONCRETE: 'Bê tông',
  BRICK: 'Gạch, ốp lát',
  ELECTRICAL: 'Vật tư điện',
  PLUMBING: 'Vật tư nước',
  FINISHING: 'Hoàn thiện',
  OTHER: 'Khác',
};

export interface Material {
  readonly id: string;
  /** Mã vật tư, cũng là nội dung mã QR dán trên kho. */
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly category: MaterialCategory;
  /** Đơn giá tham khảo (VND). */
  readonly unitPrice: number;
  readonly description: string;
}

export type MaterialUpsertRequest = Omit<Material, 'id'>;

export interface MaterialRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly unit: string;
}

/** Tồn kho một vật tư tại một công trường. */
export interface StockItem {
  readonly id: string;
  readonly projectId: string;
  readonly projectCode: string;
  readonly material: Material;
  readonly quantity: number;
  /** Mức tồn tối thiểu; dưới mức này cần yêu cầu bổ sung. */
  readonly minQuantity: number;
  /** Giá trị tồn = số lượng × đơn giá. */
  readonly value: number;
  readonly isLow: boolean;
  readonly updatedAt: string;
}

export type StockTransactionType = 'IN' | 'OUT';

export const STOCK_TRANSACTION_LABELS: Readonly<Record<StockTransactionType, string>> = {
  IN: 'Nhập kho',
  OUT: 'Xuất kho',
};

export interface StockTransaction {
  readonly id: string;
  readonly code: string;
  readonly projectId: string;
  readonly material: MaterialRef;
  readonly type: StockTransactionType;
  readonly quantity: number;
  readonly unitPrice: number;
  /** Số tồn sau giao dịch. */
  readonly balanceAfter: number;
  readonly note: string;
  /** Phiếu yêu cầu liên quan (khi nhập kho theo phiếu). */
  readonly requestId: string | null;
  readonly createdBy: UserSummary;
  readonly createdAt: string;
}

export interface StockTransactionRequest {
  readonly projectId: string;
  readonly materialId: string;
  readonly type: StockTransactionType;
  readonly quantity: number;
  readonly note: string;
}

export const MATERIAL_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'RECEIVED'] as const;
export type MaterialRequestStatus = (typeof MATERIAL_REQUEST_STATUSES)[number];

export const MATERIAL_REQUEST_STATUS_LABELS: Readonly<Record<MaterialRequestStatus, string>> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt, chờ nhập kho',
  REJECTED: 'Từ chối',
  RECEIVED: 'Đã nhập kho',
};

export interface MaterialRequestItem {
  readonly material: MaterialRef;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface MaterialRequestHistoryEntry {
  readonly action: 'CREATED' | 'APPROVED' | 'REJECTED' | 'RECEIVED';
  readonly by: UserSummary;
  readonly at: string;
  readonly note: string;
}

export interface MaterialRequest {
  readonly id: string;
  readonly code: string;
  readonly projectId: string;
  readonly projectCode: string;
  readonly items: readonly MaterialRequestItem[];
  /** Ngày cần vật tư, yyyy-MM-dd. */
  readonly neededBy: string;
  readonly note: string;
  readonly status: MaterialRequestStatus;
  readonly totalValue: number;
  readonly createdBy: UserSummary;
  readonly reviewNote: string;
  readonly history: readonly MaterialRequestHistoryEntry[];
  readonly createdAt: string;
}

export interface MaterialRequestCreate {
  readonly projectId: string;
  readonly items: readonly { readonly materialId: string; readonly quantity: number }[];
  readonly neededBy: string;
  readonly note: string;
}

export interface MaterialListParams extends ListParams {
  readonly category?: MaterialCategory | null;
}

export interface StockListParams {
  readonly projectId?: string | null;
  readonly lowOnly?: boolean;
}

export interface TransactionListParams extends ListParams {
  readonly projectId?: string | null;
  readonly materialId?: string | null;
  readonly type?: StockTransactionType | null;
}

export interface MaterialRequestListParams extends ListParams {
  readonly projectId?: string | null;
  readonly status?: MaterialRequestStatus | null;
}
