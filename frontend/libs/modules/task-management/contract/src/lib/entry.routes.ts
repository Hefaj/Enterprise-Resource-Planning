import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';
import { SHARED_KEYS } from '@erp/shared/ui';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: SHARED_KEYS.menu.taskManagement.module },
    canActivate: [erpAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'issue' },
      {
        path: 'issue',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.issues },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueComponent),
      },
      {
        path: 'project',
        pathMatch: 'full',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.projects },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.ProjectManage)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ProjectComponent),
      },
      {
        path: 'request',
        data: { breadcrumb: SHARED_KEYS.menu.requests },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.RequestComponent),
      },
      {
        path: 'workflow-scheme',
        pathMatch: 'full',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.workflowSchemes },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.SchemeManage)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.WorkflowSchemeComponent),
      },
      {
        // Konkretny schemat jest adresowalny: link do konfiguracji obiegu krąży między ludźmi,
        // którzy się nią zajmują (`docs/frontend/task-management-pages.md` §4.3).
        path: 'workflow-scheme/:uuid',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.workflowSchemes },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.SchemeManage)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.WorkflowSchemeComponent),
      },
      {
        // Karta projektu idzie po uuid, nie po kodzie: kod jest zmienny (prefiks klucza da się
        // zmienić), a link do konfiguracji nie może przestać działać po jego zmianie.
        path: 'project/:uuid',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.project },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.ProjectManage)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ProjectDetailComponent),
      },
      {
        // Wejście z menu: pozycja menu nie ma skąd wziąć uuid-a, więc strona sama rozwiązuje
        // tablicę domyślną i podmienia adres na konkretną.
        path: 'board',
        pathMatch: 'full',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.board },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardComponent),
      },
      {
        // Tablica jest adresowana UUID-em, nie kluczem: tablica nie ma nazwy czytelnej,
        // która byłaby unikalna, a jej link krąży między zakładkami, nie w mailach.
        path: 'board/:uuid',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.board },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardComponent),
      },
      {
        // Trasa karty idzie po KLUCZU czytelnym (`DEV-412`), nie po uuid — ten link krąży
        // w mailach i commitach (docs/frontend/task-management-pages.md §2.3).
        path: 'issue/:key',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.issue },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueDetailComponent),
      },
      {
        path: 'board/:uuid/backlog',
        data: { breadcrumb: SHARED_KEYS.menu.taskManagement.backlog },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BacklogComponent),
      },
    ],
  },
];
