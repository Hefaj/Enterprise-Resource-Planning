import { NxWelcome } from './nx-welcome';
import { Route } from '@angular/router';
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: 'sales',
    loadChildren: () =>
      loadRemote<typeof import('sales/Routes')>('sales/Routes').then(
        (m) => m!.remoteRoutes,
      ),
  },
  {
    path: 'inventory',
    loadChildren: () =>
      loadRemote<typeof import('inventory/Routes')>('inventory/Routes').then(
        (m) => m!.remoteRoutes,
      ),
  },
  {
    path: 'catalog',
    loadChildren: () =>
      loadRemote<typeof import('catalog/Routes')>('catalog/Routes').then(
        (m) => m!.remoteRoutes,
      ),
  },
  {
    path: '',
    component: NxWelcome,
  },
];
