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

/** `TaskManagement.Domain.Boards.BoardMode` — sprinty i backlog istnieją tylko na tablicach
 * w trybie `Scrum` (SPR-001). */
export const BOARD_MODE = {
  Kanban: 0,
  Scrum: 1,
} as const;

export type BoardModeValue = (typeof BOARD_MODE)[keyof typeof BOARD_MODE];

/** `TaskManagement.Domain.Sprints.SprintStatus` — kolejność wartości jest znacząca. */
export const SPRINT_STATUS = {
  Planned: 0,
  Active: 1,
  Closed: 2,
} as const;

export type SprintStatusValue = (typeof SPRINT_STATUS)[keyof typeof SPRINT_STATUS];

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

/** `TaskManagement.Domain.SavedViews.SavedViewMode` — tryb prezentacji listy zapamiętany razem
 * z widokiem (VIEW-001/LNK-006): lista płaska albo drzewo. */
export const SAVED_VIEW_MODE = {
  List: 0,
  Tree: 1,
} as const;

export type SavedViewModeValue = (typeof SAVED_VIEW_MODE)[keyof typeof SAVED_VIEW_MODE];

/**
 * `TaskManagement.Domain.FieldSchemes.CustomFieldDataType` — typ pola niestandardowego.
 *
 * <p>Zbiór jest zamknięty i mały, bo każdy typ ma po stronie bazy własną pulę slotów
 * sortowalnych: dołożenie typu to migracja tabeli `issue`, a nie wpis w słowniku
 * (`docs/modules/task-management/domain.md` §6).</p>
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
 * (`docs/modules/task-management/domain.md` §8.1).</p>
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
 * ani nie filtruje, nie zajmuje zasobu rzadkiego (`docs/modules/task-management/domain.md` §6).</p>
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
 * `TaskManagement.Domain.IssueTypes.IssueTypeCategory` — rodzaj typu zgłoszenia.
 *
 * <p>Po niej, nie po nazwie typu, liczy się reguła hierarchii z `LNK-001` AC2: rodzic o kategorii
 * `Subtask` jest odrzucony, dziecko o kategorii `Epic` jest odrzucone. Front nie duplikuje tej
 * reguły — sprawdza ją tylko po to, żeby pokazać komunikat PRZED wysłaniem komendy, którą backend
 * i tak odrzuci (`docs/modules/task-management/domain.md`).</p>
 */
export const ISSUE_TYPE_CATEGORY = {
  Epic: 0,
  Standard: 1,
  Subtask: 2,
} as const;

export type IssueTypeCategoryValue = (typeof ISSUE_TYPE_CATEGORY)[keyof typeof ISSUE_TYPE_CATEGORY];

/**
 * `TaskManagement.Application.Issues.IssueScope` — zakres listy zgłoszeń.
 * <b>Parametr, nie osobna strona</b> (patrz `docs/modules/task-management/screens.md` §2.1).
 */
export const ISSUE_SCOPE = {
  Available: 0,
  AssignedToMe: 1,
  ReportedByMe: 2,
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
  WorkLogAdded: 6,
  WorkLogRemoved: 7,
  AttachmentRemoved: 8,
  ExternalLinkAdded: 9,
  ExternalLinkRemoved: 10,
} as const;

export type IssueActivityKindValue = (typeof ISSUE_ACTIVITY_KIND)[keyof typeof ISSUE_ACTIVITY_KIND];

/** `TaskManagement.Domain.Boards.BoardSwimlaneMode` (BRD-006) — oś grupowania wierszy tablicy. */
export const BOARD_SWIMLANE_MODE = {
  None: 0,
  Assignee: 1,
  Epic: 2,
  Priority: 3,
  CustomField: 4,
} as const;

export type BoardSwimlaneModeValue = (typeof BOARD_SWIMLANE_MODE)[keyof typeof BOARD_SWIMLANE_MODE];

/** `TaskManagement.Domain.Issues.IssueDeliveryState` (REQ-003) — wyliczony stan realizacji
 * zlecenia; `None` dla zgłoszeń, które nie są zleceniem. */
export const ISSUE_DELIVERY_STATE = {
  None: 0,
  InProgress: 1,
  Delivered: 2,
} as const;

export type IssueDeliveryStateValue = (typeof ISSUE_DELIVERY_STATE)[keyof typeof ISSUE_DELIVERY_STATE];

/** `TaskManagement.Domain.Projects.SlaWorkingDays` — flagi dnia roboczego (faza 5, SLA-001). */
export const SLA_WORKING_DAYS = {
  None: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 4,
  Thursday: 8,
  Friday: 16,
  Saturday: 32,
  Sunday: 64,
} as const;

/** Domyślny kalendarz roboczy (poniedziałek–piątek) — punkt wyjścia formularza SLA, zanim
 * użytkownik go zmieni. */
export const SLA_WORKING_DAYS_DEFAULT =
  SLA_WORKING_DAYS.Monday | SLA_WORKING_DAYS.Tuesday | SLA_WORKING_DAYS.Wednesday | SLA_WORKING_DAYS.Thursday | SLA_WORKING_DAYS.Friday;

/** `TaskManagement.Domain.Automation.AutomationTriggerKind` (faza 8, AUT-001 `when`). */
export const AUTOMATION_TRIGGER_KIND = {
  IssueCreated: 0,
  IssueStateChanged: 1,
  CommentAdded: 2,
  DueDateElapsed: 3,
} as const;

export type AutomationTriggerKindValue =
  (typeof AUTOMATION_TRIGGER_KIND)[keyof typeof AUTOMATION_TRIGGER_KIND];

/** `TaskManagement.Domain.Webhooks.WebhookDeliveryStatus` (faza 8, API-004). */
export const WEBHOOK_DELIVERY_STATUS = {
  Pending: 0,
  Sent: 1,
  Failed: 2,
} as const;

export type WebhookDeliveryStatusValue =
  (typeof WEBHOOK_DELIVERY_STATUS)[keyof typeof WEBHOOK_DELIVERY_STATUS];

/** `TaskManagement.Domain.Automation.AutomationActionKind` (faza 8, AUT-001 `then`) — zamknięta
 * lista, żadnych skryptów (AC1). */
export const AUTOMATION_ACTION_KIND = {
  SetPriority: 0,
  SetState: 1,
  AssignTo: 2,
  AddTag: 3,
  AddComment: 4,
  SendNotification: 5,
  CreateSubtask: 6,
} as const;

export type AutomationActionKindValue =
  (typeof AUTOMATION_ACTION_KIND)[keyof typeof AUTOMATION_ACTION_KIND];

/** `TaskManagement.Domain.Automation.Conditions.AutomationComparisonOperator` — wąski język
 * warunku reguły (AUT-001 `if`, ten sam co przyszłe `guard` z WF-003/DMS §4.4). */
export const AUTOMATION_COMPARISON_OPERATOR = {
  Eq: 0,
  Ne: 1,
  Gt: 2,
  Gte: 3,
  Lt: 4,
  Lte: 5,
} as const;

export type AutomationComparisonOperatorValue =
  (typeof AUTOMATION_COMPARISON_OPERATOR)[keyof typeof AUTOMATION_COMPARISON_OPERATOR];

/** `TaskManagement.Domain.Automation.AutomationRunOutcome` (AUT-002 AC1) — log uruchomień
 * reguły. */
export const AUTOMATION_RUN_OUTCOME = {
  Executed: 0,
  Failed: 1,
} as const;

export type AutomationRunOutcomeValue =
  (typeof AUTOMATION_RUN_OUTCOME)[keyof typeof AUTOMATION_RUN_OUTCOME];

/** Whitelista ścieżek pola w warunku reguły — `TaskManagement.Domain.Automation.Conditions.AutomationFieldPath`.
 * Pola niestandardowe (zależne od profilu projektu) są świadomie poza zakresem fazy 8. */
export const AUTOMATION_FIELD_PATH = {
  Priority: 'priority',
  Type: 'type',
  State: 'state',
  StateCategory: 'state.category',
  Assignee: 'assignee',
  Tag: 'tag',
} as const;

export type AutomationFieldPathValue =
  (typeof AUTOMATION_FIELD_PATH)[keyof typeof AUTOMATION_FIELD_PATH];
