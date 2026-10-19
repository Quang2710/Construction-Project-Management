import { ListParams } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';

export const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  PLANNING: 'Chuẩn bị đầu tư',
  IN_PROGRESS: 'Đang thi công',
  ON_HOLD: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
};

export interface ProjectLocation {
  readonly address: string;
  readonly province: string;
  readonly lat: number;
  readonly lng: number;
}

export interface ProjectTaskStats {
  readonly total: number;
  readonly done: number;
  readonly overdue: number;
}

export interface Project {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** Chủ đầu tư. */
  readonly clientName: string;
  readonly location: ProjectLocation;
  /** yyyy-MM-dd */
  readonly startDate: string;
  /** yyyy-MM-dd */
  readonly endDate: string;
  /** Ngân sách (VND). */
  readonly budget: number;
  /** Chi phí thực tế đã phát sinh (VND). */
  readonly actualCost: number;
  readonly status: ProjectStatus;
  readonly managerId: string | null;
  readonly manager: UserSummary | null;
  /** Kỹ sư được gán vào dự án (SITE_ENGINEER chỉ thấy dự án mình được gán). */
  readonly memberIds: readonly string[];
  /** % hoàn thành thực tế, tính từ công việc. */
  readonly progress: number;
  /** % hoàn thành theo kế hoạch tại thời điểm hiện tại. */
  readonly plannedProgress: number;
  readonly isDelayed: boolean;
  readonly isOverBudget: boolean;
  readonly taskStats: ProjectTaskStats;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectUpsertRequest {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly clientName: string;
  readonly location: ProjectLocation;
  readonly startDate: string;
  readonly endDate: string;
  readonly budget: number;
  readonly status: ProjectStatus;
  readonly managerId: string | null;
  readonly memberIds: readonly string[];
}

export interface ProjectListParams extends ListParams {
  readonly status?: ProjectStatus | null;
}

/** 34 tỉnh, thành phố sau sắp xếp đơn vị hành chính 2025. */
export const PROVINCES: readonly string[] = [
  'TP. Hà Nội',
  'TP. Hồ Chí Minh',
  'TP. Hải Phòng',
  'TP. Đà Nẵng',
  'TP. Cần Thơ',
  'TP. Huế',
  'An Giang',
  'Bắc Ninh',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Tĩnh',
  'Hưng Yên',
  'Khánh Hòa',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sơn La',
  'Tây Ninh',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tuyên Quang',
  'Vĩnh Long',
];
