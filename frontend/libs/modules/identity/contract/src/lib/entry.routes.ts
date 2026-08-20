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
        loadComponent: () => import('@erp/identity/feature').then((m) => m.DashboardComponent),
      },
      {
        path: 'grants',
        data: { breadcrumb: 'Historia nadań' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Identity.RoleManage)],
        loadComponent: () => import('@erp/identity/feature').then((m) => m.GrantAuditComponent),
      },
      {
        path: 'users',
        data: { breadcrumb: 'Użytkownicy' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Identity.UserRead)],
        loadComponent: () => import('@erp/identity/feature').then((m) => m.UsersComponent),
      },
      {
        path: 'roles',
        data: { breadcrumb: 'Role' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Identity.RoleRead)],
        loadComponent: () => import('@erp/identity/feature').then((m) => m.RolesComponent),
      },
      {
        path: 'permissions',
        data: { breadcrumb: 'Uprawnienia' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.Identity.PermissionRead)],
        loadComponent: () => import('@erp/identity/feature').then((m) => m.PermissionsComponent),
      },
    ],
  },
];
