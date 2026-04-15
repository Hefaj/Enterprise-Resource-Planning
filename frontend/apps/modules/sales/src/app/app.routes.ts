import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadChildren: () => import('@erp/sales/contract').then((m) => m.remoteRoutes),
  },
];
