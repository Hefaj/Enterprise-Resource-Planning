import { MaybeSignal } from '@erp/shared/ui';
import { ErpTagChipItem } from '../erp-tag-chips';

/**
 * Karta na tablicy (`docs/modules/task-management/screens.md` §9.3) — niesie klucz, tytuł,
 * znacznik typu, awatar przypisanego, priorytet, tagi i estymatę (`BoardCardDto` rozszerzone
 * o `tagUuids`/`estimateMinutes`).
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

  /** Chipsy tagów — puste ukrywa wiersz całkiem, karta bez tagów nie ma po co pokazywać
   * pustego miejsca. */
  tags?: MaybeSignal<readonly ErpTagChipItem[]>;

  /** Minuty estymaty; `undefined` ukrywa znacznik (zgłoszenie bez estymaty, nie „0"). */
  estimateMinutes?: MaybeSignal<number | undefined>;

  /** Karta wygaszona i niedostępna do przeciągnięcia — własny ruch, na który serwer jeszcze
   * nie odpowiedział (nakładka optymistyczna), zamiast pozwalać na drugi ruch nad pierwszym. */
  disabled?: MaybeSignal<boolean>;
}
