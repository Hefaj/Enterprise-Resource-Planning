import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Katalog' },
    canActivate: [erpAuthGuard],
    loadComponent: () => import('@erp/catalog/feature').then((m) => m.RemoteEntry),
    children: [
      {
        path: 'products',
        data: { breadcrumb: 'Lista produktów' },
        loadComponent: () => import('@erp/catalog/feature').then((m) => m.ProductComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('@erp/catalog/feature').then((m) => m.ProductComponent),
  },
];
