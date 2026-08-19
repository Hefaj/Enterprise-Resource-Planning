import { UserAccountDto, UserRoleGrantDto, UserPermissionGrantDto } from '../../api-client';
import { RoleVM } from '../role/role.view-model';

/**
 * Przypisanie roli wzbogacone o rozwiązaną rolę — `UserAccountDto.roleGrants` to lista OBIEKTÓW
 * przypisania (nie samych UUID-ów), więc wzbogacona wersja nadpisuje pole pod tą samą nazwą wg
 * wzorca z `docs/frontend/orchestrators.md` §4 (rozszerzenie elementu, nie zduplikowane pole).
 */
export interface UserRoleGrantVM extends UserRoleGrantDto {
  readonly role: RoleVM | null;
}

/** Uprawnienia bezpośrednie nie wymagają rozwiązywania — DTO już niesie wszystko, czego UI potrzebuje. */
export type UserPermissionGrantVM = UserPermissionGrantDto;

export interface UserVM extends UserAccountDto {
  readonly roleGrants: UserRoleGrantVM[];
  readonly permissionGrants: UserPermissionGrantVM[];
}
