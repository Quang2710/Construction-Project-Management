import { ListParams } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  TODO: 'Cần làm',
  IN_PROGRESS: 'Đang làm',
  REVIEW: 'Chờ nghiệm thu',
  DONE: 'Hoàn thành',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

/** Gợi ý nhãn thường dùng ở công trường. */
export const TASK_LABEL_SUGGESTIONS: readonly string[] = [
  'Kết cấu',
  'Phần ngầm',
  'Điện',
  'Cấp thoát nước',
  'M&E',
  'Hoàn thiện',
  'An toàn',
  'Thiết kế',
  'Pháp lý',
  'Vật tư',
  'Nghiệm thu',
  'PCCC',
];

export interface TaskProjectRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly project: TaskProjectRef;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly assigneeId: string | null;
  readonly assignee: UserSummary | null;
  /** Ngày bắt đầu, yyyy-MM-dd. */
  readonly startDate: string;
  /** Hạn hoàn thành (ngày kết thúc), yyyy-MM-dd. */
  readonly dueDate: string;
  /** 0..100 */
  readonly percentComplete: number;
  readonly labels: readonly string[];
  /** Thứ tự trong cột Kanban (số thực, sắp xếp tăng dần). */
  readonly order: number;
  /** Hạng mục WBS chứa công việc (null = cấp gốc của dự án). */
  readonly wbsId: string | null;
  /** Công việc phải xong trước (phụ thuộc Finish-to-Start). */
  readonly dependencyIds: readonly string[];
  /** Mốc tiến độ: thời lượng 0, bắt đầu = kết thúc. */
  readonly isMilestone: boolean;
  readonly commentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TaskCreateRequest {
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly assigneeId: string | null;
  readonly startDate: string;
  readonly dueDate: string;
  readonly percentComplete: number;
  readonly labels: readonly string[];
  readonly wbsId?: string | null;
  readonly dependencyIds?: readonly string[];
  readonly isMilestone?: boolean;
}

export type TaskUpdateRequest = Partial<Omit<TaskCreateRequest, 'projectId'> & { order: number }>;

export interface TaskListParams extends ListParams {
  readonly projectId?: string | null;
  readonly assigneeId?: string | null;
  readonly status?: TaskStatus | null;
}

export interface TaskComment {
  readonly id: string;
  readonly taskId: string;
  readonly author: UserSummary;
  readonly content: string;
  readonly createdAt: string;
}
