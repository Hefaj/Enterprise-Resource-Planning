import { ErpNavigationItem } from '@erp/shared/data-access';
import { ERP_PERMISSIONS } from '@erp/shared/auth';

/**
 * Menu modułu. Każda pozycja ma `requiredPermission` — poprzednia zaślepka
 * („Dashboard Analityczny Zadań") nie miała żadnego i prowadziła do pustego ekranu.
 *
 * Karta zgłoszenia (`/issue/:key`) nie ma pozycji w menu: wchodzi się na nią z listy albo
 * z linku (`docs/frontend/task-management-pages.md` §7). Tablice, Zlecenia i grupa
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
];
