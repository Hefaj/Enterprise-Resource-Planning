import { Route } from '@angular/router';
import { authGuard, guestGuard } from '@erp/auth';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { AppLayout } from './layouts/app.layout';
import { TilewindLayout } from './_layouts/tilewind/tilewind';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./_components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: TilewindLayout,
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
        data: { breadcrumb: 'Sprzedaż' },
        loadChildren: () => loadRemote<typeof import('@erp/sales/Routes')>('sales/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'inventory',
        data: { breadcrumb: 'Magazyn' },
        loadChildren: () =>
          loadRemote<typeof import('@erp/inventory/Routes')>('inventory/Routes').then((m) => m!.remoteRoutes),
      },
      {
        path: 'catalog',
        data: { breadcrumb: 'Katalog' },
        loadChildren: () => loadRemote<typeof import('@erp/catalog/Routes')>('catalog/Routes').then((m) => m!.remoteRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
