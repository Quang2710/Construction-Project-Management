import { Routes } from '@angular/router';
import { PERMISSIONS } from '../../core/auth/permissions';
import { roleGuard } from '../../core/auth/role.guard';
import { AppRouteData } from '../../core/auth/route-data';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

const loadForm = () =>
  import('./pages/diary-form-page/diary-form-page.component').then((m) => m.DiaryFormPageComponent);

export const SITE_DIARIES_ROUTES: Routes = [
  {
    path: '',
    title: 'Nhật ký công trường',
    loadComponent: () =>
      import('./pages/diary-calendar-page/diary-calendar-page.component').then((m) => m.DiaryCalendarPageComponent),
  },
  {
    path: 'new',
    title: 'Lập nhật ký',
    canActivate: [roleGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Lập nhật ký', roles: PERMISSIONS.editDiaries } satisfies AppRouteData,
    loadComponent: loadForm,
  },
  {
    path: ':id',
    data: { breadcrumb: 'Chi tiết' } satisfies AppRouteData,
    children: [
      {
        path: '',
        title: 'Chi tiết nhật ký',
        loadComponent: () =>
          import('./pages/diary-detail-page/diary-detail-page.component').then((m) => m.DiaryDetailPageComponent),
      },
      {
        path: 'edit',
        title: 'Sửa nhật ký',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { breadcrumb: 'Chỉnh sửa', roles: PERMISSIONS.editDiaries } satisfies AppRouteData,
        loadComponent: loadForm,
      },
    ],
  },
];
