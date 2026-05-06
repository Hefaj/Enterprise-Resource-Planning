import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Zadania w firmie' },
    canActivate: [erpAuthGuard],
    loadComponent: () => import('@erp/task-management/feature').then((m) => m.RemoteEntry),
    children: [
      {
        path: 'tasks',
        data: { breadcrumb: 'Zadania' },
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.TaskComponent),
      },
    ],
  },
];
