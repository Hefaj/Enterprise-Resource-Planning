/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Route } from '@angular/router';
import { erpAuthGuard, erpGuestGuard } from '@erp/shared/auth';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { getCachedRemoteRoutes } from '@erp/shared/data-access';

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
        loadChildren: () => {
          const cached = getCachedRemoteRoutes('sales');
          if (cached) return cached;
          return loadRemoteModule({
            remoteName: 'sales',
            exposedModule: './contract',
          }).then((m) => m.remoteRoutes);
        },
      },
      {
        path: 'inventory',
        loadChildren: () => {
          const cached = getCachedRemoteRoutes('inventory');
          if (cached) return cached;
          return loadRemoteModule({
            remoteName: 'inventory',
            exposedModule: './contract',
          }).then((m) => m.remoteRoutes);
        },
      },
      {
        path: 'catalog',
        loadChildren: () => {
          const cached = getCachedRemoteRoutes('catalog');
          if (cached) return cached;
          return loadRemoteModule({
            remoteName: 'catalog',
            exposedModule: './contract',
          }).then((m) => m.remoteRoutes);
        },
      },
      {
        path: 'dms',
        loadChildren: () => {
          const cached = getCachedRemoteRoutes('dms');
          if (cached) return cached;
          return loadRemoteModule({
            remoteName: 'dms',
            exposedModule: './contract',
          }).then((m) => m.remoteRoutes);
        },
      },
      {
        path: 'task-management',
        loadChildren: () => {
          const cached = getCachedRemoteRoutes('task-management');
          if (cached) return cached;
          return loadRemoteModule({
            remoteName: 'task-management',
            exposedModule: './contract',
          }).then((m) => m.remoteRoutes);
        },
      },
      {
        path: 'notification',
        loadChildren: () => {
          const cached = getCachedRemoteRoutes('notification');
          if (cached) return cached;
          return loadRemoteModule({
            remoteName: 'notification',
            exposedModule: './contract',
          }).then((m) => m.remoteRoutes);
        },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
