import { Injectable, computed } from '@angular/core';
import { UserRoleGrantVM } from '@erp/identity/data-access';
import { UserScopeTabStore } from '../user-scope-tab.store';

/**
 * Wiersz tabeli ról — przypisanie roli + użytkownik, do którego należy. `roleUuid` sam nie
 * identyfikuje wiersza, bo ta sama rola bywa przypisana wielu zaznaczonym użytkownikom.
 */
export interface UserRoleGrantRow {
  readonly userUuid: string;
  readonly grant: UserRoleGrantVM;
}

@Injectable() // Rejestrowany na poziomie UserRolesTabComponent, aby żył tylko tyle co zakładka
export class UserRolesTabStore extends UserScopeTabStore<UserRoleGrantRow> {
  /**
   * Zaznaczone przypisania pogrupowane po użytkowniku — payload akcji operujących na WSKAZANYCH
   * przypisaniach („odbierz TĘ rolę TEMU użytkownikowi", nie „odbierz rolę wszystkim").
   */
  public readonly selectedRolesByUser = computed<Record<string, string[]>>(() => {
    const dict: Record<string, string[]> = {};
    for (const row of this.selectedChildren()) {
      (dict[row.userUuid] ??= []).push(row.grant.roleUuid);
    }
    return dict;
  });

  public constructor() {
    super();
  }
}
