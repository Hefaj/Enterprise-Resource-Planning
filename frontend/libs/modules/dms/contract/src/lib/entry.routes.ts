import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Dms' },
    canActivate: [erpAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'document',
      },
      {
        path: 'document',
        data: { breadcrumb: 'Dokumenty' },
        loadComponent: () => import('@erp/dms/feature').then((m) => m.DocumentComponent),
      },
    ],
  },
];
