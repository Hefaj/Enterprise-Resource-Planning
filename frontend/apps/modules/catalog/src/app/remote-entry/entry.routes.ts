import { Route } from '@angular/router';
import { RemoteEntry } from './entry';
import { authGuard } from '@erp/shared/auth';
import { ProductComponent } from './_components/product/product';

export const remoteRoutes: Route[] = [
  {
    path: '',
    canActivate: [authGuard],
    component: RemoteEntry,
    children: [
      {
        path: 'products',
        loadComponent: () => import('./_components/product/product').then((m) => m.ProductComponent),
      },
    ],
  },
  {
    path: '**',
    component: ProductComponent,
  },
];
