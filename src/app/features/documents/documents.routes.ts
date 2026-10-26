import { Routes } from '@angular/router';
import { AppRouteData } from '../../core/auth/route-data';

export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Hồ sơ bản vẽ',
    loadComponent: () => import('./pages/documents-page/documents-page.component').then((m) => m.DocumentsPageComponent),
  },
  {
    path: ':id',
    title: 'Bản vẽ',
    data: { breadcrumb: 'Bản vẽ' } satisfies AppRouteData,
    loadComponent: () => import('./pages/drawing-page/drawing-page.component').then((m) => m.DrawingPageComponent),
  },
];
