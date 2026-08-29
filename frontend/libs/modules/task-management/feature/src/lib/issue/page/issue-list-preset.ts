import { InjectionToken } from '@angular/core';
import { SearchIssueRequest } from '@erp/task-management/data-access';

/** Różnice między listą zgłoszeń i listą zleceń — filtr roli, nie drugi agregat. */
export interface IssueListPreset {
  readonly filters: Partial<SearchIssueRequest>;
  readonly stateKey: string;
  readonly label: string;
}

export const ISSUE_LIST_PRESET = new InjectionToken<IssueListPreset>('ISSUE_LIST_PRESET');
