import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Sprzedaż' },
    canActivate: [erpAuthGuard],
    loadComponent: () => import('@erp/sales/feature').then((m) => m.SalesComponent),
  },
];
