import {
  ISSUE_CREATE_MODAL_ID,
  ISSUE_SET_ASSIGNEE_MODAL_ID,
  ISSUE_SET_STATE_MODAL_ID,
} from '@erp/task-management/util';

/**
 * Identyfikatory modali tego modułu.
 *
 * Lekka tablica stringów (zero importów z `feature`) ładowana przy STARTUP razem z menu —
 * służy do zbudowania globalnej mapy `modalId → modulePrefix`, zanim jakikolwiek modal zostanie
 * otwarty. Rozdzielone od `registerModals()` celowo: „co istnieje" jest tanie i synchroniczne,
 * „jak to załadować" — kosztowne i leniwe (patrz `docs/frontend/modals.md` §7).
 */
export const remoteModalIds: string[] = [
  ISSUE_CREATE_MODAL_ID,
  ISSUE_SET_STATE_MODAL_ID,
  ISSUE_SET_ASSIGNEE_MODAL_ID,
];

/** Leniwie ładuje tokeny DI definicji modali tego modułu. */
export async function registerModals(): Promise<unknown[]> {
  const { IssueCreateModalDefinition, IssueSetStateModalDefinition, IssueSetAssigneeModalDefinition } = await import(
    '@erp/task-management/feature'
  );
  return [IssueCreateModalDefinition, IssueSetStateModalDefinition, IssueSetAssigneeModalDefinition];
}

/**
 * Providery wstrzykiwane modalom tego modułu przez `ErpModalService`.
 *
 * Definicje modali NIGDY nie wołają `.setProviders(...)` w builderze — scope tłumaczeń dokłada
 * tutaj kontrakt remota, dzięki czemu modal ma swoje tłumaczenia niezależnie od tego, z którego
 * miejsca aplikacji został otwarty (`docs/frontend/translations.md` §3).
 */
export async function getModalProviders(): Promise<unknown[]> {
  const { provideIssueTranslations } = await import('@erp/task-management/feature');
  return provideIssueTranslations();
}
