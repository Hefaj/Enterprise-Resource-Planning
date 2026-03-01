import { Route } from '@angular/router';
import { authGuard } from '@auth';
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./_components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'sales',
    canActivate: [authGuard],
    loadChildren: () => loadRemote<typeof import('sales/Routes')>('sales/Routes').then((m) => m!.remoteRoutes),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadChildren: () => loadRemote<typeof import('inventory/Routes')>('inventory/Routes').then((m) => m!.remoteRoutes),
  },
  {
    path: 'catalog',
    canActivate: [authGuard],
    loadChildren: () => loadRemote<typeof import('catalog/Routes')>('catalog/Routes').then((m) => m!.remoteRoutes),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
