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
} as const;

export type IssueScopeValue = (typeof ISSUE_SCOPE)[keyof typeof ISSUE_SCOPE];
