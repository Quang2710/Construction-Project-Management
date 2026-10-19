import { Routes } from '@angular/router';
import { provideGanttConfig } from '../../core/config/gantt.config';

export const SCHEDULING_ROUTES: Routes = [
  {
    path: '',
    title: 'Tiến độ',
    providers: [provideGanttConfig()],
    loadComponent: () => import('./pages/schedule-page/schedule-page.component').then((m) => m.SchedulePageComponent),
  },
];
