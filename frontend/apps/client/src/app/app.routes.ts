import { Route } from '@angular/router';
import { authGuard, guestGuard } from '@erp/shared/auth';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { ShellLayoutComponent } from './_layouts/shell/shell.component';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./_components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: ShellLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./_components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'sales',
        loadChildren: () => loadRemote<typeof import('@erp/sales/Routes')>('sales/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'inventory',
        loadChildren: () =>
          loadRemote<typeof import('@erp/inventory/Routes')>('inventory/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'catalog',
        loadChildren: () =>
          loadRemote<typeof import('@erp/catalog/Routes')>('catalog/Routes').then((m) => m!.remoteRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
