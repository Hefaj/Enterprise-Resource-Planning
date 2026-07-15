/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Route } from '@angular/router';
import { erpAuthGuard, erpGuestGuard } from '@erp/shared/auth';

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
        loadChildren: () => import('@erp/sales/contract').then((m) => m.remoteRoutes),
      },
      {
        path: 'inventory',
        loadChildren: () => import('@erp/inventory/contract').then((m) => m.remoteRoutes),
      },
      {
        path: 'catalog',
        loadChildren: () => import('@erp/catalog/contract').then((m) => m.remoteRoutes),
      },
      {
        path: 'dms',
        loadChildren: () => import('@erp/dms/contract').then((m) => m.remoteRoutes),
      },
      {
        path: 'task-management',
        loadChildren: () => import('@erp/task-management/contract').then((m) => m.remoteRoutes),
      },
      {
        path: 'notification',
        loadChildren: () => import('@erp/notification/contract').then((m) => m.remoteRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
