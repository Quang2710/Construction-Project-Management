import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { AppRouteData } from './core/auth/route-data';
import { NAV_ITEMS, NavItem } from './core/layout/navigation';

function navItem(path: string): NavItem {
  const item = NAV_ITEMS.find((nav) => nav.path === path);
  if (!item) {
    throw new Error(`Thiếu cấu hình menu cho "${path}"`);
  }
  return item;
}

/** Route của một module trong menu: tiêu đề, breadcrumb và phân quyền lấy từ navigation.ts. */
function moduleRoute(path: string, route: Omit<Route, 'path'>): Route {
  const item = navItem(path);
  const data: AppRouteData = { breadcrumb: item.label, roles: item.roles };
  return { path, title: item.label, canActivate: [roleGuard], data, ...route };
}

/**
 * Module chưa xây dựng: tạm trỏ tới trang placeholder nhưng vẫn áp dụng đúng phân quyền.
 * Khi làm feature thật, thay bằng loadChildren tới features/<tên-feature>.
 */
function placeholderRoute(item: NavItem): Route {
  return {
    ...moduleRoute(item.path, {
      loadComponent: () =>
        import('./shared/ui/feature-placeholder/feature-placeholder.component').then(
          (m) => m.FeaturePlaceholderComponent,
        ),
    }),
    data: { breadcrumb: item.label, roles: item.roles, description: item.description, icon: item.icon },
  };
}

const IMPLEMENTED_PATHS = new Set(['dashboard', 'projects', 'tasks', 'schedule', 'site-diaries', 'materials', 'map', 'budget']);

export const routes: Routes = [
  {
    path: 'login',
    title: 'Đăng nhập',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      moduleRoute('dashboard', {
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      }),
      moduleRoute('projects', {
        title: undefined,
        loadChildren: () => import('./features/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
      }),
      moduleRoute('tasks', {
        title: undefined,
        loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
      }),
      moduleRoute('schedule', {
        title: undefined,
        loadChildren: () => import('./features/scheduling/scheduling.routes').then((m) => m.SCHEDULING_ROUTES),
      }),
      moduleRoute('site-diaries', {
        title: undefined,
        loadChildren: () => import('./features/site-diaries/site-diaries.routes').then((m) => m.SITE_DIARIES_ROUTES),
      }),
      moduleRoute('materials', {
        loadComponent: () =>
          import('./features/materials/pages/materials-page/materials-page.component').then(
            (m) => m.MaterialsPageComponent,
          ),
      }),
      moduleRoute('budget', {
        loadComponent: () => import('./features/cost/pages/cost-page/cost-page.component').then((m) => m.CostPageComponent),
      }),
      moduleRoute('map', {
        loadComponent: () =>
          import('./features/projects/pages/projects-map-page/projects-map-page.component').then(
            (m) => m.ProjectsMapPageComponent,
          ),
      }),
      ...NAV_ITEMS.filter((item) => !IMPLEMENTED_PATHS.has(item.path)).map(placeholderRoute),
      {
        path: 'forbidden',
        title: 'Không có quyền truy cập',
        data: { breadcrumb: 'Không có quyền truy cập' } satisfies AppRouteData,
        loadComponent: () =>
          import('./features/errors/pages/forbidden-page/forbidden-page.component').then(
            (m) => m.ForbiddenPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Không tìm thấy trang',
    loadComponent: () =>
      import('./features/errors/pages/not-found-page/not-found-page.component').then((m) => m.NotFoundPageComponent),
  },
];
