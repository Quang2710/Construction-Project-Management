import { Routes } from '@angular/router';
import { PERMISSIONS } from '../../core/auth/permissions';
import { roleGuard } from '../../core/auth/role.guard';
import { AppRouteData } from '../../core/auth/route-data';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

const loadForm = () =>
  import('./pages/project-form-page/project-form-page.component').then((m) => m.ProjectFormPageComponent);

export const PROJECTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Dự án',
    loadComponent: () =>
      import('./pages/project-list-page/project-list-page.component').then((m) => m.ProjectListPageComponent),
  },
  {
    path: 'new',
    title: 'Tạo dự án',
    canActivate: [roleGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Tạo mới', roles: PERMISSIONS.manageProjects } satisfies AppRouteData,
    loadComponent: loadForm,
  },
  {
    path: ':id',
    data: { breadcrumb: 'Chi tiết' } satisfies AppRouteData,
    children: [
      {
        path: '',
        title: 'Chi tiết dự án',
        loadComponent: () =>
          import('./pages/project-detail-page/project-detail-page.component').then((m) => m.ProjectDetailPageComponent),
      },
      {
        path: 'edit',
        title: 'Chỉnh sửa dự án',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { breadcrumb: 'Chỉnh sửa', roles: PERMISSIONS.manageProjects } satisfies AppRouteData,
        loadComponent: loadForm,
      },
    ],
  },
];
