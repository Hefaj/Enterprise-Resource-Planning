import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';
import { CATALOG_DOCUMENTATION_ARTICLE_IDS } from '@erp/catalog/util';

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
        data: {
          breadcrumb: 'Lista produktów',
          documentationArticleId: CATALOG_DOCUMENTATION_ARTICLE_IDS.products.listAndFilters,
        },
        loadComponent: () => import('@erp/catalog/feature').then((m) => m.ProductComponent),
      },
      {
        // Biblioteka mediów — pliki widziane jako własne zasoby, nie jako galeria produktu.
        // Bramka na `dictionary.read`, bo tego wymagają endpointy odczytu multimediów
        // (`searchMultimedia`, `getMultimedia`); samo usuwanie ma osobne uprawnienie,
        // sprawdzane na akcji toolbara i na endpointcie.
        path: 'multimedia',
        data: {
          breadcrumb: 'Biblioteka mediów',
          documentationArticleId: CATALOG_DOCUMENTATION_ARTICLE_IDS.multimedia.library,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Catalog.DictionaryRead)],
        loadComponent: () => import('@erp/catalog/feature').then((m) => m.MultimediaComponent),
      },
      {
        path: 'documentation',
        data: { breadcrumb: 'shared.documentation.navigationLabel' },
        loadComponent: () => import('@erp/catalog/feature').then((module) => module.CatalogDocumentationComponent),
      },
      {
        path: 'documentation/:articleSlug',
        data: { breadcrumb: 'shared.documentation.navigationLabel' },
        loadComponent: () => import('@erp/catalog/feature').then((module) => module.CatalogDocumentationComponent),
      },
    ],
  },
];
