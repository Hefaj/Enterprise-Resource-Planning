import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'WMS' },
    canActivate: [erpAuthGuard],
    loadComponent: () => import('@erp/inventory/feature').then((m) => m.InventoryComponent),
  },
];
