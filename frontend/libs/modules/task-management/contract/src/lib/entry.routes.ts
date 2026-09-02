import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Zarządzanie pracą' },
    canActivate: [erpAuthGuard],
    // Scope `taskManagement` (stany/priorytety/rodzaje) jest wspólny dla listy, tablicy, karty
    // i konfiguracji projektu — cztery różne agregaty feature. Rejestracja tutaj, na trasie
    // agregującej moduł, a nie w dekoratorze pojedynczego komponentu (docs/frontend/translations.md).
    providers: [provideTaskManagementTranslations()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'issue' },
      {
        path: 'issue',
        data: { breadcrumb: 'Zgłoszenia' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueComponent),
      },
      {
        path: 'request',
        pathMatch: 'full',
        data: { breadcrumb: 'Zlecenia' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.RequestComponent),
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
        // Wejście z menu: lista tablic widocznych użytkownikowi (BRD-009); przy jednej
        // widocznej tablicy strona sama przekierowuje wprost na nią.
        path: 'board',
        pathMatch: 'full',
        data: { breadcrumb: 'Tablice' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardListComponent),
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
        // Podstrona tablicy, nie osobna pozycja w menu — sprint i backlog istnieją tylko
        // w kontekście konkretnej tablicy scrumowej (docs/frontend/task-management-pages.md §2.4).
        path: 'board/:uuid/backlog',
        data: { breadcrumb: 'Backlog' },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BacklogComponent),
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
