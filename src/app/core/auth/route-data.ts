import { Data } from '@angular/router';
import { isUserRole, UserRole } from '../../shared/models/user.model';

/** Các key data dùng chung trong cấu hình route. */
export interface AppRouteData {
  /** Nhãn hiển thị trên breadcrumb. */
  readonly breadcrumb?: string;
  /** Các role được phép truy cập; bỏ trống = mọi user đã đăng nhập. */
  readonly roles?: readonly UserRole[];
}

export function getRouteRoles(data: Data): readonly UserRole[] | null {
  const roles: unknown = data['roles'];
  return Array.isArray(roles) ? roles.filter(isUserRole) : null;
}

export function getRouteBreadcrumb(data: Data): string | null {
  const label: unknown = data['breadcrumb'];
  return typeof label === 'string' ? label : null;
}
