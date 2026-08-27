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
        path: 'project',
        pathMatch: 'full',
        data: { breadcrumb: 'Projekty' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ProjectComponent),
      },
      {
        // Karta projektu idzie po uuid, nie po kodzie: kod jest zmienny (prefiks klucza da się
        // zmienić), a link do konfiguracji nie może przestać działać po jego zmianie.
        path: 'project/:uuid',
        data: { breadcrumb: 'Projekt' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.ProjectManage)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ProjectDetailComponent),
      },
      {
        // Wejście z menu: pozycja menu nie ma skąd wziąć uuid-a, więc strona sama rozwiązuje
        // tablicę domyślną i podmienia adres na konkretną.
        path: 'board',
        pathMatch: 'full',
        data: { breadcrumb: 'Tablica' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardComponent),
      },
      {
        // Tablica jest adresowana UUID-em, nie kluczem: tablica nie ma nazwy czytelnej,
        // która byłaby unikalna, a jej link krąży między zakładkami, nie w mailach.
        path: 'board/:uuid',
        data: { breadcrumb: 'Tablica' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardComponent),
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
