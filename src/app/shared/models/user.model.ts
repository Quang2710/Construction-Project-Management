export const USER_ROLES = ['ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'CLIENT'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ADMIN: 'Quản trị hệ thống',
  PROJECT_MANAGER: 'Quản lý dự án',
  SITE_ENGINEER: 'Kỹ sư công trường',
  CLIENT: 'Chủ đầu tư',
};

export interface User {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
  /** Chức danh hiển thị, ví dụ "Chỉ huy trưởng công trường". */
  readonly jobTitle: string;
  readonly phone: string;
  readonly active: boolean;
  readonly createdAt: string;
}

/** Thông tin rút gọn của user khi được nhúng trong resource khác. */
export interface UserSummary {
  readonly id: string;
  readonly fullName: string;
  readonly jobTitle: string;
  readonly role: UserRole;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
