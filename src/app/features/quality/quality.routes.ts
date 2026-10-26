import { Routes } from '@angular/router';
import { AppRouteData } from '../../core/auth/route-data';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const QUALITY_ROUTES: Routes = [
  {
    path: '',
    title: 'Chất lượng',
    loadComponent: () => import('./pages/quality-page/quality-page.component').then((m) => m.QualityPageComponent),
  },
  {
    path: 'inspections/:id',
    title: 'Phiếu nghiệm thu',
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Phiếu nghiệm thu' } satisfies AppRouteData,
    loadComponent: () => import('./pages/inspection-page/inspection-page.component').then((m) => m.InspectionPageComponent),
  },
  {
    path: 'punch/:id',
    title: 'Lỗi cần xử lý',
    data: { breadcrumb: 'Punch list' } satisfies AppRouteData,
    loadComponent: () => import('./pages/punch-page/punch-page.component').then((m) => m.PunchPageComponent),
  },
];
