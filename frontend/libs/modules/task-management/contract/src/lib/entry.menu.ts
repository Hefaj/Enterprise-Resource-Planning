import { ErpNavigationItem } from '@erp/shared/data-access';
import { ERP_PERMISSIONS } from '@erp/shared/auth';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

/**
 * Menu modułu. Każda pozycja ma `requiredPermission` — poprzednia zaślepka
 * („Dashboard Analityczny Zadań") nie miała żadnego i prowadziła do pustego ekranu.
 *
 * Karta zgłoszenia (`/issue/:key`) nie ma pozycji w menu: wchodzi się na nią z listy albo
 * z linku (`docs/modules/task-management/screens.md` §7). Pozycja „Tablica" prowadzi do trasy
 * bez uuid-a, która rozwiązuje tablicę domyślną i podmienia adres — menu nie ma skąd wziąć
 * identyfikatora konkretnej tablicy. Pozycja w menu pojawia się dopiero razem z działającą trasą.
 */
export const remoteMenu: ErpNavigationItem[] = [
  {
    label: TASKMANAGEMENT_KEYS.navigation.issues,
    labelKey: TASKMANAGEMENT_KEYS.navigation.issues,
    iconId: 'list-checks',
    route: 'issue',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: TASKMANAGEMENT_KEYS.navigation.requests,
    labelKey: TASKMANAGEMENT_KEYS.navigation.requests,
    iconId: 'send',
    route: 'request',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: TASKMANAGEMENT_KEYS.navigation.configuration,
    labelKey: TASKMANAGEMENT_KEYS.navigation.configuration,
    iconId: 'settings',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.ProjectManage,
    children: [
      {
        label: TASKMANAGEMENT_KEYS.navigation.projects,
        labelKey: TASKMANAGEMENT_KEYS.navigation.projects,
        iconId: 'folder-kanban',
        route: 'project',
        requiredPermission: ERP_PERMISSIONS.TaskManagement.ProjectManage,
      },
    ],
  },
  {
    label: TASKMANAGEMENT_KEYS.navigation.boards,
    labelKey: TASKMANAGEMENT_KEYS.navigation.boards,
    iconId: 'columns-3',
    route: 'board',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: TASKMANAGEMENT_KEYS.navigation.reports,
    labelKey: TASKMANAGEMENT_KEYS.navigation.reports,
    iconId: 'chart-bar',
    route: 'report',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.ReportReadAll,
  },
  {
    label: 'shared.documentation.navigationLabel',
    labelKey: 'shared.documentation.navigationLabel',
    iconId: 'book-open',
    route: 'documentation',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
];
