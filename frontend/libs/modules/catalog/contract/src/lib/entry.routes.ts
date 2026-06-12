import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Katalog' },
    canActivate: [erpAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'products',
      },
      {
        path: 'products',
        data: { breadcrumb: 'Lista produktów' },
        loadComponent: () => import('@erp/catalog/feature').then((m) => m.ProductComponent),
      },
    ],
  },
];
