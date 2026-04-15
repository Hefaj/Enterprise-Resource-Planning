import { Route } from '@angular/router';
import { RemoteEntry } from '../../../feature/src/lib/entry';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Sprzedaż' },
    component: RemoteEntry,
  },
];
