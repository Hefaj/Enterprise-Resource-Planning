import { Route } from '@angular/router';
import { RemoteEntry } from './entry';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Sprzedaż' },
    component: RemoteEntry,
  },
];
