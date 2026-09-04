import { Route } from '@angular/router';
import { ERP_PERMISSIONS, erpAuthGuard, erpPermissionGuard } from '@erp/shared/auth';
import { provideTaskManagementTranslations } from '@erp/task-management/ui';
import { TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS } from '@erp/task-management/util';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'Zarządzanie pracą' },
    canActivate: [erpAuthGuard],
    // Scope `taskManagement` (stany/priorytety/rodzaje) jest wspólny dla listy, tablicy, karty
    // i konfiguracji projektu — cztery różne agregaty feature. Rejestracja tutaj, na trasie
    // agregującej moduł, a nie w dekoratorze pojedynczego komponentu (docs/guides/frontend/translations.md).
    providers: [provideTaskManagementTranslations()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'issue' },
      {
        path: 'issue',
        data: {
          breadcrumb: 'Zgłoszenia',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.issues.list,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueComponent),
      },
      {
        path: 'request',
        pathMatch: 'full',
        data: {
          breadcrumb: 'Zlecenia',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.requests,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.RequestComponent),
      },
      {
        path: 'project',
        pathMatch: 'full',
        data: {
          breadcrumb: 'Projekty',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.projects.list,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ProjectComponent),
      },
      {
        // Karta projektu idzie po uuid, nie po kodzie: kod jest zmienny (prefiks klucza da się
        // zmienić), a link do konfiguracji nie może przestać działać po jego zmianie.
        path: 'project/:uuid',
        data: {
          breadcrumb: 'Projekt',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.projects.detail,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.ProjectManage)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ProjectDetailComponent),
      },
      {
        // Wejście z menu: lista tablic widocznych użytkownikowi (BRD-009); przy jednej
        // widocznej tablicy strona sama przekierowuje wprost na nią.
        path: 'board',
        pathMatch: 'full',
        data: {
          breadcrumb: 'Tablice',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.boards.list,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardListComponent),
      },
      {
        // Tablica jest adresowana UUID-em, nie kluczem: tablica nie ma nazwy czytelnej,
        // która byłaby unikalna, a jej link krąży między zakładkami, nie w mailach.
        path: 'board/:uuid',
        data: {
          breadcrumb: 'Tablica',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.boards.board,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BoardComponent),
      },
      {
        // Podstrona tablicy, nie osobna pozycja w menu — sprint i backlog istnieją tylko
        // w kontekście konkretnej tablicy scrumowej (docs/modules/task-management/screens.md §2.4).
        path: 'board/:uuid/backlog',
        data: {
          breadcrumb: 'Backlog',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.boards.backlog,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.BacklogComponent),
      },
      {
        // Trasa karty idzie po KLUCZU czytelnym (`DEV-412`), nie po uuid — ten link krąży
        // w mailach i commitach (docs/modules/task-management/screens.md §2.3).
        path: 'issue/:key',
        data: {
          breadcrumb: 'Zgłoszenie',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.issues.detail,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.IssueRead)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.IssueDetailComponent),
      },
      {
        // Raport rozliczenia godzin (RPT-002) — bramkowany osobnym uprawnieniem
        // (PERM-005), nie `IssueRead`: gatuje same endpointy raportów, celowo poza predykatem
        // widoczności zgłoszeń (docs/modules/task-management/requirements.md).
        path: 'report',
        pathMatch: 'full',
        data: {
          breadcrumb: 'Raport godzin',
          documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.reports.hours,
        },
        canActivate: [erpPermissionGuard(ERP_PERMISSIONS.TaskManagement.ReportReadAll)],
        loadComponent: () => import('@erp/task-management/feature').then((m) => m.ReportComponent),
      },
      {
        path: 'documentation',
        data: { breadcrumb: 'shared.documentation.navigationLabel' },
        loadComponent: () => import('@erp/task-management/feature').then((module) => module.TaskManagementDocumentationComponent),
      },
      {
        path: 'documentation/:articleSlug',
        data: { breadcrumb: 'shared.documentation.navigationLabel' },
        loadComponent: () => import('@erp/task-management/feature').then((module) => module.TaskManagementDocumentationComponent),
      },
    ],
  },
];
