/**
 * Klucze tłumaczeń opisujące operacje masowe Task Management w feedzie powiadomień.
 *
 * Leżą w scope'ie `shared`, nie `taskManagement` — wiersz powiadomienia renderuje komponent
 * z modułu `notification`, który nie ma (i nie powinien mieć) załadowanego scope'u tłumaczeń
 * tego modułu. Ten sam wzorzec co `IDENTITY_JOB_COMMAND_KEYS` w `@erp/identity/util`.
 *
 * Stałe mieszkają w `util`, bo używa ich `data-access` (orkiestratory, przy zlecaniu operacji
 * masowych), a ten nie może zależeć od `type:ui`.
 */
export const TASK_MANAGEMENT_JOB_COMMAND_KEYS = {
  createIssue: 'shared.jobs.commands.taskmgmtIssueCreate',
  setIssueTitle: 'shared.jobs.commands.taskmgmtIssueSetTitle',
  setIssueDescription: 'shared.jobs.commands.taskmgmtIssueSetDescription',
  setIssuePriority: 'shared.jobs.commands.taskmgmtIssueSetPriority',
  setIssueAssignee: 'shared.jobs.commands.taskmgmtIssueSetAssignee',
  setIssueDueDate: 'shared.jobs.commands.taskmgmtIssueSetDueDate',
  setIssueState: 'shared.jobs.commands.taskmgmtIssueSetState',
  addIssueComment: 'shared.jobs.commands.taskmgmtIssueAddComment',
  setIssueCommentBody: 'shared.jobs.commands.taskmgmtIssueSetCommentBody',
  removeIssueComment: 'shared.jobs.commands.taskmgmtIssueRemoveComment',
} as const;
