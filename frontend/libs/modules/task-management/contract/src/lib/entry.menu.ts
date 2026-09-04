import { ErpNavigationItem } from '@erp/shared/data-access';
import { ERP_PERMISSIONS } from '@erp/shared/auth';

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
    label: 'Zgłoszenia',
    iconId: 'list-checks',
    route: 'issue',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: 'Zlecenia',
    iconId: 'send',
    route: 'request',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: 'Projekty',
    iconId: 'folder-kanban',
    route: 'project',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: 'Tablica',
    iconId: 'columns-3',
    route: 'board',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
  {
    label: 'Raport godzin',
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
