import { Routes } from '@angular/router';

export const TASKS_ROUTES: Routes = [
  {
    path: '',
    title: 'Công việc',
    loadComponent: () => import('./pages/kanban-page/kanban-page.component').then((m) => m.KanbanPageComponent),
  },
];
