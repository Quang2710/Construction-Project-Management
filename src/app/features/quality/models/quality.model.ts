import { ListParams } from '../../../shared/models/api.model';
import { Photo } from '../../../shared/models/photo.model';
import { UserRole, UserSummary } from '../../../shared/models/user.model';

export interface QualityProjectRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

// ---------------------------------------------------------------------------
// Phiếu nghiệm thu (checklist theo hạng mục WBS) + quy trình duyệt nhiều cấp
// ---------------------------------------------------------------------------

export const INSPECTION_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS_LABELS: Readonly<Record<InspectionStatus, string>> = {
  DRAFT: 'Bản nháp',
  IN_REVIEW: 'Đang duyệt',
  APPROVED: 'Đã nghiệm thu',
  REJECTED: 'Không đạt',
};

/** Chỉ người lập sửa được checklist khi còn nháp hoặc bị trả lại. */
export const EDITABLE_INSPECTION_STATUSES: readonly InspectionStatus[] = ['DRAFT', 'REJECTED'];

export interface ApprovalLevelConfig {
  readonly level: number;
  readonly label: string;
  readonly roles: readonly UserRole[];
}

/**
 * Các cấp duyệt phiếu nghiệm thu nội bộ nhà thầu, duyệt tuần tự.
 * CLIENT chỉ đọc nên không tham gia duyệt; khi có BE thật, thêm cấp tư vấn giám sát / chủ đầu tư tại đây.
 */
export const INSPECTION_APPROVAL_LEVELS: readonly ApprovalLevelConfig[] = [
  { level: 1, label: 'Chỉ huy trưởng / Quản lý dự án', roles: ['PROJECT_MANAGER', 'ADMIN'] },
  { level: 2, label: 'Phòng QA/QC', roles: ['ADMIN'] },
];

export const CHECK_RESULTS = ['PASS', 'FAIL', 'NA'] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const CHECK_RESULT_LABELS: Readonly<Record<CheckResult, string>> = {
  PASS: 'Đạt',
  FAIL: 'Không đạt',
  NA: 'Không áp dụng',
};

export interface ChecklistItem {
  readonly id: string;
  readonly criterion: string;
  /** Yêu cầu kỹ thuật / tiêu chuẩn tham chiếu (TCVN...). */
  readonly requirement: string;
  /** null = chưa đánh giá. */
  readonly result: CheckResult | null;
  readonly note: string;
}

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface ApprovalStep {
  readonly level: number;
  readonly label: string;
  readonly decision: ApprovalDecision | null;
  readonly by: UserSummary | null;
  readonly at: string | null;
  readonly note: string;
}

export type InspectionAction = 'CREATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export const INSPECTION_ACTION_LABELS: Readonly<Record<InspectionAction, string>> = {
  CREATED: 'Lập phiếu',
  SUBMITTED: 'Gửi duyệt',
  APPROVED: 'Duyệt',
  REJECTED: 'Trả lại',
};

export interface InspectionHistoryEntry {
  readonly action: InspectionAction;
  readonly level: number | null;
  readonly by: UserSummary;
  readonly at: string;
  readonly note: string;
}

export interface Inspection {
  readonly id: string;
  readonly code: string;
  readonly projectId: string;
  readonly project: QualityProjectRef;
  readonly wbsId: string;
  /** "3.1 · Phần thân - Tầng 5" */
  readonly wbsName: string;
  readonly templateId: string;
  readonly title: string;
  readonly location: string;
  /** yyyy-MM-dd */
  readonly inspectionDate: string;
  readonly items: readonly ChecklistItem[];
  readonly status: InspectionStatus;
  /** Cấp đang chờ duyệt khi IN_REVIEW; null ở các trạng thái khác. */
  readonly currentLevel: number | null;
  /** Lượt duyệt hiện tại (reset khi gửi duyệt lại). */
  readonly approvals: readonly ApprovalStep[];
  readonly history: readonly InspectionHistoryEntry[];
  readonly createdBy: UserSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly stats: InspectionStats;
}

export interface InspectionStats {
  readonly total: number;
  readonly pass: number;
  readonly fail: number;
  readonly na: number;
  readonly pending: number;
  /** Punch item gắn với phiếu và chưa được xác nhận đóng. */
  readonly openPunchItems: number;
}

export interface InspectionCreateRequest {
  readonly projectId: string;
  readonly wbsId: string;
  readonly templateId: string;
  readonly title: string;
  readonly location: string;
  readonly inspectionDate: string;
}

export interface InspectionUpdateRequest {
  readonly title: string;
  readonly location: string;
  readonly inspectionDate: string;
  readonly items: readonly ChecklistItemInput[];
}

/** id rỗng = tiêu chí mới thêm. */
export type ChecklistItemInput = Omit<ChecklistItem, 'id'> & { readonly id: string | null };

export interface InspectionListParams extends ListParams {
  readonly projectId?: string | null;
  readonly status?: InspectionStatus | null;
  /** true: chỉ phiếu đang chờ cấp mà người gọi có quyền duyệt. */
  readonly awaitingMe?: boolean | null;
}

export interface ChecklistTemplate {
  readonly id: string;
  readonly name: string;
  readonly items: readonly { readonly criterion: string; readonly requirement: string }[];
}

// ---------------------------------------------------------------------------
// Punch list: lỗi cần xử lý, gán người, hạn, ảnh trước/sau
// ---------------------------------------------------------------------------

export const PUNCH_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED'] as const;
export type PunchStatus = (typeof PUNCH_STATUSES)[number];

export const PUNCH_STATUS_LABELS: Readonly<Record<PunchStatus, string>> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Chờ xác nhận',
  VERIFIED: 'Đã đóng',
};

export const PUNCH_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type PunchSeverity = (typeof PUNCH_SEVERITIES)[number];

export const PUNCH_SEVERITY_LABELS: Readonly<Record<PunchSeverity, string>> = {
  LOW: 'Nhẹ',
  MEDIUM: 'Trung bình',
  HIGH: 'Nghiêm trọng',
};

export type PunchAction = 'CREATED' | 'STARTED' | 'RESOLVED' | 'VERIFIED' | 'REOPENED' | 'REASSIGNED';

export const PUNCH_ACTION_LABELS: Readonly<Record<PunchAction, string>> = {
  CREATED: 'Ghi nhận lỗi',
  STARTED: 'Bắt đầu xử lý',
  RESOLVED: 'Báo đã khắc phục',
  VERIFIED: 'Xác nhận đóng',
  REOPENED: 'Mở lại',
  REASSIGNED: 'Giao lại',
};

export interface PunchHistoryEntry {
  readonly action: PunchAction;
  readonly by: UserSummary;
  readonly at: string;
  readonly note: string;
}

export interface PunchItem {
  readonly id: string;
  readonly code: string;
  readonly projectId: string;
  readonly project: QualityProjectRef;
  readonly inspectionId: string | null;
  readonly inspectionCode: string | null;
  /** Tiêu chí không đạt sinh ra lỗi này (nếu có). */
  readonly checklistItemId: string | null;
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly severity: PunchSeverity;
  readonly status: PunchStatus;
  readonly assignee: UserSummary | null;
  /** yyyy-MM-dd */
  readonly dueDate: string;
  readonly isOverdue: boolean;
  readonly beforePhotos: readonly Photo[];
  readonly afterPhotos: readonly Photo[];
  readonly history: readonly PunchHistoryEntry[];
  readonly createdBy: UserSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PunchCreateRequest {
  readonly projectId: string;
  readonly inspectionId: string | null;
  readonly checklistItemId: string | null;
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly severity: PunchSeverity;
  readonly assigneeId: string;
  readonly dueDate: string;
  readonly beforePhotos: readonly Photo[];
}

export type PunchTransition = 'start' | 'resolve' | 'verify' | 'reopen';

export interface PunchTransitionRequest {
  readonly note: string;
  /** Bắt buộc khi resolve: ảnh sau khi khắc phục. */
  readonly afterPhotos?: readonly Photo[];
}

export interface PunchListParams extends ListParams {
  readonly projectId?: string | null;
  readonly status?: PunchStatus | null;
  readonly severity?: PunchSeverity | null;
  readonly inspectionId?: string | null;
  readonly assigneeId?: string | null;
  readonly overdue?: boolean | null;
}
