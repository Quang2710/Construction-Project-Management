import { UserRole } from '../../shared/models/user.model';

export interface NavItem {
  readonly label: string;
  /** Tên icon Material Symbols. */
  readonly icon: string;
  /** Đường dẫn tuyệt đối không có dấu "/" đầu, ví dụ "projects". */
  readonly path: string;
  readonly description: string;
  /** Bỏ trống = mọi role đều thấy. */
  readonly roles?: readonly UserRole[];
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

const MANAGERS: readonly UserRole[] = ['ADMIN', 'PROJECT_MANAGER'];
const FIELD_TEAM: readonly UserRole[] = ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER'];
const FINANCE_VIEWERS: readonly UserRole[] = ['ADMIN', 'PROJECT_MANAGER', 'CLIENT'];

/** Nguồn duy nhất cho menu sidebar và quyền truy cập route tương ứng. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Tổng quan',
    items: [
      { label: 'Bảng điều khiển', icon: 'dashboard', path: 'dashboard', description: 'Tình hình chung các dự án' },
      { label: 'Dự án', icon: 'apartment', path: 'projects', description: 'Danh sách và thông tin dự án' },
      { label: 'Bản đồ công trình', icon: 'map', path: 'map', description: 'Vị trí các công trình trên bản đồ' },
    ],
  },
  {
    title: 'Thi công',
    items: [
      { label: 'Công việc', icon: 'view_kanban', path: 'tasks', description: 'Bảng Kanban công việc', roles: FIELD_TEAM },
      { label: 'Tiến độ', icon: 'view_timeline', path: 'schedule', description: 'Biểu đồ Gantt tiến độ thi công' },
      // CLIENT vẫn vào được nhưng chỉ thấy nhật ký đã duyệt (lọc ở BE).
      { label: 'Nhật ký công trường', icon: 'menu_book', path: 'site-diaries', description: 'Báo cáo thi công hằng ngày và ảnh hiện trường' },
      // CLIENT xem phiếu đã nghiệm thu và punch list (lọc ở BE), không ghi được.
      { label: 'Chất lượng', icon: 'fact_check', path: 'quality', description: 'Nghiệm thu, punch list và duyệt nhiều cấp' },
      { label: 'Bản vẽ', icon: 'draw', path: 'documents', description: 'Hồ sơ bản vẽ theo phiên bản, xem và so sánh PDF' },
      { label: 'Vật tư', icon: 'inventory_2', path: 'materials', description: 'Nhập, xuất, tồn kho vật tư', roles: FIELD_TEAM },
      { label: 'Nhân sự', icon: 'engineering', path: 'workforce', description: 'Nhân công, tổ đội và chấm công', roles: MANAGERS },
    ],
  },
  {
    title: 'Tài chính',
    items: [
      { label: 'Ngân sách', icon: 'payments', path: 'budget', description: 'Dự toán, chi phí và thanh toán', roles: FINANCE_VIEWERS },
      { label: 'Báo cáo', icon: 'monitoring', path: 'reports', description: 'Báo cáo tiến độ và chi phí', roles: FINANCE_VIEWERS },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { label: 'Người dùng', icon: 'group', path: 'admin/users', description: 'Tài khoản và phân quyền', roles: ['ADMIN'] },
      { label: 'Cấu hình hệ thống', icon: 'settings', path: 'admin/settings', description: 'Danh mục và tham số hệ thống', roles: ['ADMIN'] },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** Lọc menu theo role; section rỗng sẽ bị ẩn. */
export function filterNavSections(sections: readonly NavSection[], role: UserRole | null): NavSection[] {
  if (!role) {
    return [];
  }
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
