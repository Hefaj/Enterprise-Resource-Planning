import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Zarządzanie pracą' },
    canActivate: [erpAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'issue' },
      {
        path: 'issue',
        data: { breadcrumb: 'Zgłoszenia' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueComponent),
      },
      {
        // Trasa karty idzie po KLUCZU czytelnym (`DEV-412`), nie po uuid — ten link krąży
        // w mailach i commitach (docs/frontend/task-management-pages.md §2.3).
        path: 'issue/:key',
        data: { breadcrumb: 'Zgłoszenie' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueDetailComponent),
      },
    ],
  },
];
