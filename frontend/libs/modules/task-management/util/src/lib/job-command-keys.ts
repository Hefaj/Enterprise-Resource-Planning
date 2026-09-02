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
  setIssueCustomFields: 'shared.jobs.commands.taskmgmtIssueSetCustomFields',
  setIssueParent: 'shared.jobs.commands.taskmgmtIssueSetParent',
  addIssueLink: 'shared.jobs.commands.taskmgmtIssueAddLink',
  removeIssueLink: 'shared.jobs.commands.taskmgmtIssueRemoveLink',
  createFieldScheme: 'shared.jobs.commands.taskmgmtFieldSchemeCreate',
  addSchemeField: 'shared.jobs.commands.taskmgmtFieldSchemeAddField',
  removeSchemeField: 'shared.jobs.commands.taskmgmtFieldSchemeRemoveField',
  setProjectFieldScheme: 'shared.jobs.commands.taskmgmtProjectSetFieldScheme',
  setBoardCardPosition: 'shared.jobs.commands.taskmgmtBoardSetCardPosition',
  setIssueType: 'shared.jobs.commands.taskmgmtIssueSetType',
  createIssueTypeScheme: 'shared.jobs.commands.taskmgmtIssueTypeSchemeCreate',
  addIssueTypeSchemeType: 'shared.jobs.commands.taskmgmtIssueTypeSchemeAddType',
  removeIssueTypeSchemeType: 'shared.jobs.commands.taskmgmtIssueTypeSchemeRemoveType',
  setIssueTypeSchemeType: 'shared.jobs.commands.taskmgmtIssueTypeSchemeSetType',
  setProjectIssueTypeScheme: 'shared.jobs.commands.taskmgmtProjectSetIssueTypeScheme',
  addIssueWatcher: 'shared.jobs.commands.taskmgmtIssueAddWatcher',
  removeIssueWatcher: 'shared.jobs.commands.taskmgmtIssueRemoveWatcher',
  setProjectSla: 'shared.jobs.commands.taskmgmtProjectSetSla',
  setBoardCardSprint: 'shared.jobs.commands.taskmgmtBoardSetCardSprint',
  createSprint: 'shared.jobs.commands.taskmgmtSprintCreate',
  setSprintDates: 'shared.jobs.commands.taskmgmtSprintSetDates',
  execStartSprint: 'shared.jobs.commands.taskmgmtSprintExecStart',
  execCloseSprint: 'shared.jobs.commands.taskmgmtSprintExecClose',
  createTag: 'shared.jobs.commands.taskmgmtTagCreate',
  addIssueTag: 'shared.jobs.commands.taskmgmtIssueAddTag',
  removeIssueTag: 'shared.jobs.commands.taskmgmtIssueRemoveTag',
  createResolution: 'shared.jobs.commands.taskmgmtResolutionCreate',
  setIssueResolution: 'shared.jobs.commands.taskmgmtIssueSetResolution',
  setIssueProject: 'shared.jobs.commands.taskmgmtIssueSetProject',
  addIssueWorkLog: 'shared.jobs.commands.taskmgmtIssueAddWorkLog',
  removeIssueWorkLog: 'shared.jobs.commands.taskmgmtIssueRemoveWorkLog',
  setIssueEstimate: 'shared.jobs.commands.taskmgmtIssueSetEstimate',
  removeIssueAttachment: 'shared.jobs.commands.taskmgmtIssueRemoveAttachment',
  addIssueExternalLink: 'shared.jobs.commands.taskmgmtIssueAddExternalLink',
  removeIssueExternalLink: 'shared.jobs.commands.taskmgmtIssueRemoveExternalLink',
  setProjectCode: 'shared.jobs.commands.taskmgmtProjectSetCode',
  setProjectArchived: 'shared.jobs.commands.taskmgmtProjectSetArchived',
  setBoardSwimlane: 'shared.jobs.commands.taskmgmtBoardSetSwimlane',
} as const;
