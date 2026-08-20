/**
 * Klucze tłumaczeń opisujące operacje masowe Identity w feedzie powiadomień.
 *
 * Leżą w scope'ie `shared`, nie w `identity` — wiersz powiadomienia renderuje komponent
 * z modułu `notification`, który nie ma (i nie powinien mieć) załadowanego scope'u tłumaczeń
 * Identity. Ten sam wzorzec co `CATALOG_JOB_COMMAND_KEYS` w `@erp/catalog/util`.
 *
 * Stałe mieszkają w `util`, bo używa ich `data-access` (orkiestratory, przy zlecaniu operacji
 * masowych), a ten nie może zależeć od `type:ui`.
 */
export const IDENTITY_JOB_COMMAND_KEYS = {
  assignRole: 'shared.jobs.commands.identityUserAssignRole',
  revokeRole: 'shared.jobs.commands.identityUserRevokeRole',
  grantPermission: 'shared.jobs.commands.identityUserGrantPermission',
  revokePermission: 'shared.jobs.commands.identityUserRevokePermission',
  forceLogout: 'shared.jobs.commands.identityUserForceLogout',
  createRole: 'shared.jobs.commands.identityRoleCreate',
  addRolePermission: 'shared.jobs.commands.identityRoleAddPermission',
  removeRolePermission: 'shared.jobs.commands.identityRoleRemovePermission',
  addRoleMember: 'shared.jobs.commands.identityRoleAddMember',
  removeRoleMember: 'shared.jobs.commands.identityRoleRemoveMember',
} as const;
