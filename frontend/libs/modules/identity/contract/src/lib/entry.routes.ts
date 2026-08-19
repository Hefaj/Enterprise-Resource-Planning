import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Tożsamość' },
    canActivate: [erpAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('@erp/identity/feature').then((m) => m.IdentityDashboardComponent),
      },
      {
        path: 'grants',
        data: { breadcrumb: 'Historia nadań' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Identity.RoleManage)],
        loadComponent: () => import('@erp/identity/feature').then((m) => m.GrantAuditComponent),
      },
    ],
  },
];
