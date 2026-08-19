import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Katalog' },
    canActivate: [erpAuthGuard, erpPermissionGuard(ERP_PERMISSIONS.Catalog.ProductRead)],
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
