import { InjectionToken } from '@angular/core';
import { SearchIssueRequest } from '@erp/task-management/data-access';

/** Różnice między listą zgłoszeń i listą zleceń — filtr roli, nie drugi agregat. */
export interface IssueListPreset {
  readonly filters: Partial<SearchIssueRequest>;
  readonly stateKey: string;
  readonly label: string;
  /** Lista zleceń nie jest backlogiem zespołu wykonawczego: nie pokazuje akcji sprintu ani
   * osobistych zapisanych widoków, które mogłyby zapisać filtr poza projektami Intake. */
  readonly mode?: 'issues' | 'requests';
}

export const ISSUE_LIST_PRESET = new InjectionToken<IssueListPreset>('ISSUE_LIST_PRESET');
