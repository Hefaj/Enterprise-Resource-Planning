/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Route } from '@angular/router';
import { erpAuthGuard, erpGuestGuard } from '@erp/shared/auth';
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [erpGuestGuard],
    loadComponent: () => import('@erp/shared/ui').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [erpAuthGuard],
    loadComponent: () => import('@erp/client/feature').then((m) => m.ShellLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'settings',
        data: { breadcrumb: 'Ustawienia' },
        loadComponent: () => import('@erp/client/feature').then((m) => m.SettingsComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('@erp/client/feature').then((m) => m.DashboardComponent),
      },
      {
        path: 'sales',
        loadChildren: () => loadRemote<typeof import('@erp/sales/Routes')>('sales/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'inventory',
        loadChildren: () => loadRemote<typeof import('@erp/inventory/Routes')>('inventory/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'catalog',
        loadChildren: () => loadRemote<typeof import('@erp/catalog/Routes')>('catalog/Routes').then((m) => m!.remoteRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
