import { MaybeSignal } from '@erp/shared/ui';

/**
 * Karta na tablicy (`docs/modules/task-management/screens.md` §9.3) — niesie klucz, tytuł,
 * znacznik typu, awatar przypisanego, priorytet; tagi i estymatę dokłada faza 6.
 */
export interface ErpIssueCardConfig {
  issueKey: MaybeSignal<string>;

  title: MaybeSignal<string>;

  priority: MaybeSignal<number>;

  /** Klucz tłumaczenia nazwy priorytetu — komponent nie zna enuma `IssuePriority` (żyje
   * w `@erp/task-management/util`, `ui` nie ma powodu go importować dla samej etykiety). */
  priorityLabelKey: MaybeSignal<string>;

  /** Ikona typu (`IssueType.icon`) — `undefined`, dopóki `BoardCardDto` jej nie niesie
   * (dziś nie niesie — zob. raport fazy). */
  typeIcon?: MaybeSignal<string | undefined>;

  typeName?: MaybeSignal<string | undefined>;

  assigneeUuid?: MaybeSignal<string | undefined>;

  assigneeEmptyLabel?: MaybeSignal<string | undefined>;

  link: MaybeSignal<readonly unknown[]>;
}
