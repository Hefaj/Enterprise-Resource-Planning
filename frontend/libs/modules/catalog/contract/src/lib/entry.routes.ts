import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Katalog' },
    canActivate: [erpAuthGuard, erpPermissionGuard(ERP_PERMISSIONS.Catalog.ProductRead)],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'products',
      },
      {
        path: 'products',
        data: { breadcrumb: 'Lista produktów' },
        loadComponent: () => import('@erp/catalog/feature').then((m) => m.ProductComponent),
      },
      {
        // Biblioteka mediów — pliki widziane jako własne zasoby, nie jako galeria produktu.
        // Bramka na `dictionary.read`, bo tego wymagają endpointy odczytu multimediów
        // (`searchMultimedia`, `getMultimedia`); samo usuwanie ma osobne uprawnienie,
        // sprawdzane na akcji toolbara i na endpointcie.
        path: 'multimedia',
        data: { breadcrumb: 'Biblioteka mediów' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Catalog.DictionaryRead)],
        loadComponent: () => import('@erp/catalog/feature').then((m) => m.MultimediaComponent),
      },
    ],
  },
];
