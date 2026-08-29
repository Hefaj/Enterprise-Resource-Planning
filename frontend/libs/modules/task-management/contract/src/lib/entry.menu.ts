import { ErpNavigationItem } from '@erp/shared/data-access';
import { ERP_PERMISSIONS } from '@erp/shared/auth';
import { SHARED_KEYS } from '@erp/shared/ui';

/**
 * Menu modułu. Każda pozycja ma `requiredPermission` — poprzednia zaślepka
 * („Dashboard Analityczny Zadań") nie miała żadnego i prowadziła do pustego ekranu.
 *
 * Karta zgłoszenia (`/issue/:key`) nie ma pozycji w menu: wchodzi się na nią z listy albo
 * z linku (`docs/frontend/task-management-pages.md` §7). Pozycja „Tablica" prowadzi do trasy
 * bez uuid-a, która rozwiązuje tablicę domyślną i podmienia adres — menu nie ma skąd wziąć
 * identyfikatora konkretnej tablicy. Zlecenia i grupa
 * „Konfiguracja" dochodzą w swoich fazach — pozycja w menu bez działającej strony to dokładnie
 * ten błąd, który usuwamy tą zmianą.
 */
export const remoteMenu: ErpNavigationItem[] = [
  {
    label: 'Zgłoszenia',
    iconId: 'list-checks',
    route: 'issue',
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
    // Menu rysuje shell hosta przed aktywacją trasy remota, więc etykieta musi
    // należeć do globalnego scope'u `shared`, a nie ładowanego leniwie `taskManagement`.
    label: SHARED_KEYS.menu.requests,
    iconId: 'inbox',
    route: 'request',
    requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  },
];
