import { ISSUE_TYPE_CATEGORY, IssueTypeCategoryValue } from './issue-enums';

/**
 * Domyślna ikona TaigaUI per kategoria typu — używana, dopóki `IssueType.icon` nie przyjedzie
 * (np. w podglądzie zanim schemat się doładuje) albo gdy typ jej nie ustawił.
 *
 * <p>Ikona typu (`IssueType.icon`) jest zwykle wystarczająca sama w sobie (`TYP-002`: seed niesie
 * własne ikony dla `Epik`/`Funkcjonalność`/`Zadanie`/`Błąd`/`Podzadanie`), ale kategoria zostaje
 * zapasowym źródłem — typ założony z UI bez wybranej ikony ma wciąż czym się odróżnić na liście.</p>
 */
const ISSUE_TYPE_CATEGORY_ICON: Record<IssueTypeCategoryValue, string> = {
  [ISSUE_TYPE_CATEGORY.Epic]: '@tui.layers',
  [ISSUE_TYPE_CATEGORY.Standard]: '@tui.circle-dot',
  [ISSUE_TYPE_CATEGORY.Subtask]: '@tui.corner-down-right',
};

/** Klucz tłumaczenia nazwy kategorii — używany w filtrach i formularzach; nazwa samego typu
 * (`IssueType.name`/`nameKey`) idzie osobną drogą, bo jest daną, nie stałą registry. */
const ISSUE_TYPE_CATEGORY_KEY: Record<IssueTypeCategoryValue, string> = {
  [ISSUE_TYPE_CATEGORY.Epic]: 'taskManagement.issueTypeCategory.epic',
  [ISSUE_TYPE_CATEGORY.Standard]: 'taskManagement.issueTypeCategory.standard',
  [ISSUE_TYPE_CATEGORY.Subtask]: 'taskManagement.issueTypeCategory.subtask',
};

export function issueTypeCategoryIcon(category: IssueTypeCategoryValue | number | undefined): string {
  return ISSUE_TYPE_CATEGORY_ICON[category as IssueTypeCategoryValue] ?? ISSUE_TYPE_CATEGORY_ICON[ISSUE_TYPE_CATEGORY.Standard];
}

export function issueTypeCategoryKey(category: IssueTypeCategoryValue | number | undefined): string {
  return ISSUE_TYPE_CATEGORY_KEY[category as IssueTypeCategoryValue] ?? ISSUE_TYPE_CATEGORY_KEY[ISSUE_TYPE_CATEGORY.Standard];
}

/** `LNK-001` AC2 — rodzic o kategorii `Subtask` jest zawsze odrzucony. */
export function canBeParentCategory(category: IssueTypeCategoryValue | number | undefined): boolean {
  return category !== ISSUE_TYPE_CATEGORY.Subtask;
}

/** `LNK-001` AC2 — dziecko o kategorii `Epic` jest zawsze odrzucony. */
export function canBeChildCategory(category: IssueTypeCategoryValue | number | undefined): boolean {
  return category !== ISSUE_TYPE_CATEGORY.Epic;
}
