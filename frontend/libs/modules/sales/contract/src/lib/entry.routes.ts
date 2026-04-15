import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Sprzedaż' },
    loadComponent: () => import('@erp/sales/feature').then((m) => m.RemoteEntry),
  },
];
