import { Route } from '@angular/router';
import { authGuard, guestGuard } from '@erp/auth';
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./_components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./_layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./_components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'sales',
        data: { breadcrumb: 'Sprzedaż' },
        loadChildren: () => loadRemote<typeof import('sales/Routes')>('sales/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'inventory',
        data: { breadcrumb: 'Magazyn' },
        loadChildren: () =>
          loadRemote<typeof import('inventory/Routes')>('inventory/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'catalog',
        data: { breadcrumb: 'Katalog' },
        loadChildren: () => loadRemote<typeof import('catalog/Routes')>('catalog/Routes').then((m) => m!.remoteRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
