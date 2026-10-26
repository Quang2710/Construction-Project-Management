import { UserRole } from '../../shared/models/user.model';

/**
 * Ma trận quyền dùng chung cho UI (*hasRole) và fake BE (authenticate).
 * CLIENT chỉ đọc nên không xuất hiện trong bất kỳ quyền ghi nào.
 */
export const PERMISSIONS = {
  manageProjects: ['ADMIN', 'PROJECT_MANAGER'],
  editTasks: ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER'],
  deleteTasks: ['ADMIN', 'PROJECT_MANAGER'],
  commentTasks: ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER'],
  /** Lập, sửa, gửi duyệt nhật ký công trường. */
  editDiaries: ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER'],
  /** Duyệt / trả lại nhật ký (ADMIN được phép với vai trò quản trị). */
  approveDiaries: ['ADMIN', 'PROJECT_MANAGER'],
  /** Danh mục vật tư, mức tồn tối thiểu. */
  manageMaterials: ['ADMIN', 'PROJECT_MANAGER'],
  /** Lập phiếu yêu cầu, nhập/xuất kho tại công trường. */
  handleStock: ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER'],
  approveMaterialRequests: ['ADMIN', 'PROJECT_MANAGER'],
  /** Xem dự toán, chi phí, phát sinh, thanh toán (CLIENT xem, không thấy lãi/lỗ). */
  viewCosts: ['ADMIN', 'PROJECT_MANAGER', 'CLIENT'],
  /** Ghi chi phí, phát sinh, cập nhật thanh toán; xem lãi/lỗ. */
  manageCosts: ['ADMIN', 'PROJECT_MANAGER'],
  /** Lập phiếu nghiệm thu, ghi nhận punch item (duyệt theo INSPECTION_APPROVAL_LEVELS). */
  editQuality: ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER'],
  /** Xác nhận đóng / mở lại / giao lại punch item. */
  verifyPunch: ['ADMIN', 'PROJECT_MANAGER'],
  /** Tải lên bản vẽ mới / phiên bản mới (mọi role đều xem được). */
  manageDocuments: ['ADMIN', 'PROJECT_MANAGER'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;
