/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Route } from '@angular/router';
import { erpAuthGuard, erpGuestGuard } from '@erp/shared/auth';
import { loadModuleRoutes } from './module-loaders';

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
        loadChildren: () => loadModuleRoutes('sales'),
      },
      {
        path: 'inventory',
        loadChildren: () => loadModuleRoutes('inventory'),
      },
      {
        path: 'catalog',
        loadChildren: () => loadModuleRoutes('catalog'),
      },
      {
        path: 'dms',
        loadChildren: () => loadModuleRoutes('dms'),
      },
      {
        path: 'task-management',
        loadChildren: () => loadModuleRoutes('task-management'),
      },
      {
        path: 'notification',
        loadChildren: () => loadModuleRoutes('notification'),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
