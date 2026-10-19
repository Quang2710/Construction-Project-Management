import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { getRouteRoles } from './route-data';

/** Kiểm tra route.data.roles; user không đủ quyền được chuyển tới trang 403. */
export const roleGuard: CanActivateFn = (route) => {
  const roles = getRouteRoles(route.data);
  if (!roles || inject(AuthStore).hasAnyRole(roles)) {
    return true;
  }
  return inject(Router).createUrlTree(['/forbidden']);
};
