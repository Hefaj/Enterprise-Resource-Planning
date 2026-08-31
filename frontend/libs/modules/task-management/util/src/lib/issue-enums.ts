/**
 * Kopie wyliczeń backendu. Klient NSwag oddaje je jako `number` (tak samo jak `status` produktu
 * w Catalogu — dokument OpenAPI nie niesie nazw wariantów), więc front potrzebuje własnej,
 * nazwanej wersji. Przy zmianie po stronie `TaskManagement.Domain` trzeba dopisać tutaj —
 * ten sam kontrakt ręcznie dublowany, co `permission-codes.ts` w `@erp/shared/auth`.
 */

/** `TaskManagement.Domain.Issues.IssuePriority` — kolejność wartości jest znacząca. */
export const ISSUE_PRIORITY = {
  Lowest: 0,
  Low: 1,
  Normal: 2,
  High: 3,
  Critical: 4,
} as const;

export type IssuePriorityValue = (typeof ISSUE_PRIORITY)[keyof typeof ISSUE_PRIORITY];

/**
 * `TaskManagement.Domain.Workflow.WorkflowStateCategory` — <b>po niej</b>, nie po nazwie stanu,
 * liczy się „czy zgłoszenie jest jeszcze w pracy".
 */
export const WORKFLOW_STATE_CATEGORY = {
  Todo: 0,
  InProgress: 1,
  Done: 2,
} as const;

export type WorkflowStateCategoryValue =
  (typeof WORKFLOW_STATE_CATEGORY)[keyof typeof WORKFLOW_STATE_CATEGORY];

/**
 * `TaskManagement.Domain.FieldSchemes.CustomFieldDataType` — typ pola niestandardowego.
 *
 * <p>Zbiór jest zamknięty i mały, bo każdy typ ma po stronie bazy własną pulę slotów
 * sortowalnych: dołożenie typu to migracja tabeli `issue`, a nie wpis w słowniku
 * (`docs/backend/task-management.md` §6).</p>
 */
export const CUSTOM_FIELD_DATA_TYPE = {
  Text: 0,
  Number: 1,
  Date: 2,
  User: 3,
  Select: 4,
} as const;

export type CustomFieldDataTypeValue =
  (typeof CUSTOM_FIELD_DATA_TYPE)[keyof typeof CUSTOM_FIELD_DATA_TYPE];

/**
 * `TaskManagement.Domain.Issues.IssueLinkType` — rodzaj powiązania.
 *
 * <p>`Blocks` to jedyny typ, który musi być acykliczny; `Delivers` jest zarezerwowany dla
 * zleceń międzydziałowych (faza 5) i nie wolno go używać jako zwykłego powiązania
 * (`docs/backend/task-management.md` §8.1).</p>
 */
export const ISSUE_LINK_TYPE = {
  Blocks: 0,
  Duplicates: 1,
  Relates: 2,
  Delivers: 3,
} as const;

export type IssueLinkTypeValue = (typeof ISSUE_LINK_TYPE)[keyof typeof ISSUE_LINK_TYPE];

/**
 * `TaskManagement.Domain.FieldSchemes.FieldSlot` — slot sortowalny na `issue`.
 *
 * <p>`None` jest wartością pełnoprawną, nie brakiem decyzji: pole, po którym nikt nie sortuje
 * ani nie filtruje, nie zajmuje zasobu rzadkiego (`docs/backend/task-management.md` §6).</p>
 */
export const FIELD_SLOT = {
  None: 0,
  Num1: 1,
  Num2: 2,
  Num3: 3,
  Num4: 4,
  Text1: 11,
  Text2: 12,
  Text3: 13,
  Text4: 14,
  Date1: 21,
  Date2: 22,
  Date3: 23,
  Date4: 24,
  User1: 31,
  User2: 32,
} as const;

export type FieldSlotValue = (typeof FIELD_SLOT)[keyof typeof FIELD_SLOT];

/** `TaskManagement.Domain.Projects.ProjectKind`. */
export const PROJECT_KIND = {
  Delivery: 0,
  Intake: 1,
} as const;

export type ProjectKindValue = (typeof PROJECT_KIND)[keyof typeof PROJECT_KIND];

/** `TaskManagement.Domain.Projects.ProjectMemberRole`. */
export const PROJECT_MEMBER_ROLE = {
  Viewer: 0,
  Contributor: 1,
  Lead: 2,
} as const;

/**
 * `TaskManagement.Application.Issues.IssueScope` — zakres listy zgłoszeń.
 * <b>Parametr, nie osobna strona</b> (patrz `docs/frontend/task-management-pages.md` §2.1).
 */
export const ISSUE_SCOPE = {
  Available: 0,
  AssignedToMe: 1,
  ReportedByMe: 2,
  Watched: 3,
  /** Projekty, w których jestem członkiem. „Zespołu" jako bytu ten moduł nie ma i mieć nie
   * będzie — członkostwo w projekcie jest jego odpowiednikiem
   * (`docs/backend/task-management.md` §10.3). */
  MyProjects: 4,
} as const;

export type IssueScopeValue = (typeof ISSUE_SCOPE)[keyof typeof ISSUE_SCOPE];

/**
 * `TaskManagement.Domain.Issues.IssueActivityKind` — rodzaj wpisu historii.
 *
 * Rodzaj mówi, <b>jak</b> przeczytać wpis (zmiana pola, komentarz, plik), a `fieldCode` —
 * <b>czego</b> dotyczy. Front dobiera po rodzaju szablon zdania, po kodzie pola — nazwę pola.
 */
export const ISSUE_ACTIVITY_KIND = {
  Created: 0,
  FieldChanged: 1,
  StateChanged: 2,
  CommentAdded: 3,
  CommentRemoved: 4,
  AttachmentAdded: 5,
} as const;

export type IssueActivityKindValue = (typeof ISSUE_ACTIVITY_KIND)[keyof typeof ISSUE_ACTIVITY_KIND];
