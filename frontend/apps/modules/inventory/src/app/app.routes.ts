import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadChildren: () => import('@erp/inventory/contract').then((m) => m.remoteRoutes),
  },
];
