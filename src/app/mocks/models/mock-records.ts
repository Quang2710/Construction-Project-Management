import { ChangeOrder, CostCategory, PaymentMilestone } from '../../features/cost/models/cost.model';
import {
  Material,
  MaterialRequestHistoryEntry,
  MaterialRequestStatus,
  StockTransactionType,
} from '../../features/materials/models/material.model';
import { Project } from '../../features/projects/models/project.model';
import {
  ApprovalDecision,
  Inspection,
  InspectionAction,
  PunchAction,
  PunchItem,
} from '../../features/quality/models/quality.model';
import { WbsNode } from '../../features/scheduling/models/wbs.model';
import { DiaryAction, SiteDiary } from '../../features/site-diaries/models/site-diary.model';
import { Task } from '../../features/tasks/models/task.model';
import { User } from '../../shared/models/user.model';

/** Bản ghi user trong fake DB (có mật khẩu, không bao giờ trả ra ngoài API). */
export interface UserRecord extends User {
  readonly password: string;
}

/** Các field tính toán (tiến độ, cảnh báo...) không lưu, được tính lại mỗi lần đọc. */
export type ProjectRecord = Omit<
  Project,
  'manager' | 'progress' | 'plannedProgress' | 'isDelayed' | 'isOverBudget' | 'taskStats'
>;

export type TaskRecord = Omit<Task, 'project' | 'assignee' | 'commentCount'>;

export interface TaskCommentRecord {
  readonly id: string;
  readonly taskId: string;
  readonly authorId: string;
  readonly content: string;
  readonly createdAt: string;
}

export interface DiaryHistoryRecord {
  readonly action: DiaryAction;
  readonly byId: string;
  readonly at: string;
  readonly note: string;
}

export type SiteDiaryRecord = Omit<SiteDiary, 'project' | 'createdBy' | 'totalWorkers' | 'history'> & {
  readonly createdById: string;
  readonly history: readonly DiaryHistoryRecord[];
};

export type WbsRecord = Omit<WbsNode, 'code'>;

export type MaterialRecord = Material;

export interface StockRecord {
  /** `${projectId}:${materialId}` */
  readonly id: string;
  readonly projectId: string;
  readonly materialId: string;
  readonly quantity: number;
  readonly minQuantity: number;
  readonly updatedAt: string;
}

export interface StockTransactionRecord {
  readonly id: string;
  readonly code: string;
  readonly projectId: string;
  readonly materialId: string;
  readonly type: StockTransactionType;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly balanceAfter: number;
  readonly note: string;
  readonly requestId: string | null;
  readonly createdById: string;
  readonly createdAt: string;
}

export interface MaterialRequestRecord {
  readonly id: string;
  readonly code: string;
  readonly projectId: string;
  readonly items: readonly { readonly materialId: string; readonly quantity: number; readonly unitPrice: number }[];
  readonly neededBy: string;
  readonly note: string;
  readonly status: MaterialRequestStatus;
  readonly createdById: string;
  readonly reviewNote: string;
  readonly history: readonly {
    readonly action: MaterialRequestHistoryEntry['action'];
    readonly byId: string;
    readonly at: string;
    readonly note: string;
  }[];
  readonly createdAt: string;
}

export interface ContractRecord {
  /** = projectId */
  readonly id: string;
  readonly projectId: string;
  /** Giá trị hợp đồng gốc với chủ đầu tư (VND). */
  readonly originalContract: number;
}

export interface CostItemRecord {
  readonly id: string;
  readonly projectId: string;
  readonly code: string;
  readonly name: string;
  /** Dự toán chi phí (VND), đã gồm phát sinh được chấp thuận. */
  readonly budget: number;
  /** Hạng mục WBS tương ứng để tính % khối lượng; null = chi phí chung. */
  readonly wbsId: string | null;
  readonly order: number;
}

export interface CostEntryRecord {
  readonly id: string;
  readonly projectId: string;
  readonly costItemId: string;
  readonly date: string;
  readonly category: CostCategory;
  readonly description: string;
  readonly vendor: string;
  readonly documentNo: string;
  readonly amount: number;
  readonly createdById: string;
  readonly createdAt: string;
}

export type ChangeOrderRecord = Omit<ChangeOrder, 'costItemName' | 'createdBy'> & { readonly createdById: string };

export type PaymentRecord = Omit<PaymentMilestone, 'isOverdue'>;

export interface InspectionApprovalRecord {
  readonly level: number;
  readonly decision: ApprovalDecision | null;
  readonly byId: string | null;
  readonly at: string | null;
  readonly note: string;
}

export interface InspectionHistoryRecord {
  readonly action: InspectionAction;
  readonly level: number | null;
  readonly byId: string;
  readonly at: string;
  readonly note: string;
}

export type InspectionRecord = Omit<Inspection, 'project' | 'wbsName' | 'approvals' | 'history' | 'createdBy' | 'stats'> & {
  readonly createdById: string;
  readonly approvals: readonly InspectionApprovalRecord[];
  readonly history: readonly InspectionHistoryRecord[];
};

export interface PunchHistoryRecord {
  readonly action: PunchAction;
  readonly byId: string;
  readonly at: string;
  readonly note: string;
}

export type PunchRecord = Omit<
  PunchItem,
  'project' | 'inspectionCode' | 'assignee' | 'isOverdue' | 'history' | 'createdBy'
> & {
  readonly assigneeId: string | null;
  readonly createdById: string;
  readonly history: readonly PunchHistoryRecord[];
};

export interface DbSchema {
  readonly users: UserRecord[];
  readonly projects: ProjectRecord[];
  readonly wbs: WbsRecord[];
  readonly tasks: TaskRecord[];
  readonly taskComments: TaskCommentRecord[];
  readonly siteDiaries: SiteDiaryRecord[];
  readonly materials: MaterialRecord[];
  readonly stock: StockRecord[];
  readonly stockTransactions: StockTransactionRecord[];
  readonly materialRequests: MaterialRequestRecord[];
  readonly contracts: ContractRecord[];
  readonly costItems: CostItemRecord[];
  readonly costEntries: CostEntryRecord[];
  readonly changeOrders: ChangeOrderRecord[];
  readonly payments: PaymentRecord[];
  readonly inspections: InspectionRecord[];
  readonly punchItems: PunchRecord[];
}
