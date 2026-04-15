import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'WMS' },
    loadComponent: () => import('@erp/inventory/feature').then((m) => m.RemoteEntry),
  },
];
